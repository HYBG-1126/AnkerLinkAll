#include "AnkerProtocol.h"

#include <QDateTime>
#include <QRegularExpression>

namespace Anker {

QByteArray fromHex(const char *hex)
{
    return QByteArray::fromHex(QByteArray(hex));
}

QByteArray aad()
{
    return fromHex("3322110077665544bbaa9988ffeeddcc");
}

QByteArray initialKey()
{
    return fromHex("b8ff7422955d4eb6d554a2c470280559");
}

QByteArray initialNonce()
{
    return fromHex("6ba3e3f2f3a60f2971ce5d1f");
}

QByteArray loginId()
{
    return fromHex("62303932663861346533663832363864376230646339643564336538643062396431306465646264");
}

QByteArray u32le(quint32 value)
{
    QByteArray bytes(4, Qt::Uninitialized);
    for (int i = 0; i < 4; ++i)
        bytes[i] = char((value >> (8 * i)) & 0xff);
    return bytes;
}

QByteArray timestampBytes()
{
    return u32le(quint32(QDateTime::currentSecsSinceEpoch()));
}

QByteArray buildTlv(const TlvList &tlvs)
{
    QByteArray out;
    for (const Tlv &tlv : tlvs) {
        out.append(char(tlv.type));
        out.append(char(tlv.value.size()));
        out.append(tlv.value);
    }
    return out;
}

TlvList parseTlv(const QByteArray &payload, int offset)
{
    TlvList result;
    int index = offset;
    while (index + 1 < payload.size()) {
        const quint8 type = quint8(payload[index]);
        const int length = quint8(payload[index + 1]);
        if (index + 2 + length > payload.size())
            break;
        result.append({type, payload.mid(index + 2, length)});
        index += 2 + length;
    }
    return result;
}

int tlvOffset(const QByteArray &payload)
{
    return !payload.isEmpty() && payload[0] == 0x00 ? 1 : 0;
}

QMap<quint8, QByteArray> tlvMap(const QByteArray &payload)
{
    QMap<quint8, QByteArray> fields;
    for (const Tlv &tlv : parseTlv(payload, tlvOffset(payload)))
        fields.insert(tlv.type, tlv.value);
    return fields;
}

QByteArray buildFrame(const QByteArray &payload)
{
    QByteArray frame;
    const int total = 4 + int(payload.size()) + 1;
    frame.append(char(0xff));
    frame.append(char(0x09));
    frame.append(char(total & 0xff));
    frame.append(char((total >> 8) & 0xff));
    frame.append(payload);
    quint8 checksum = 0;
    for (char byte : std::as_const(frame))
        checksum ^= quint8(byte);
    frame.append(char(checksum));
    return frame;
}

std::optional<Frame> parseFrame(const QByteArray &bytes)
{
    if (bytes.size() < 10 || quint8(bytes[0]) != 0xff || quint8(bytes[1]) != 0x09)
        return std::nullopt;
    const int declared = quint8(bytes[2]) | (quint8(bytes[3]) << 8);
    const int total = qMin<int>(declared, int(bytes.size()));
    if (total < 10)
        return std::nullopt;
    const QByteArray payload = bytes.mid(4, total - 5);
    if (payload.size() < 5)
        return std::nullopt;
    const quint16 flag = quint16((quint8(payload[3]) << 8) | quint8(payload[4]));
    Frame frame;
    frame.header = payload.left(5);
    frame.body = payload.mid(5);
    frame.encrypted = (flag & 0x4000) != 0;
    frame.command = flag & 0x37ff;
    return frame;
}

QList<QByteArray> FrameStreamDecoder::append(const QByteArray &chunk)
{
    m_buffer.append(chunk);
    QList<QByteArray> frames;
    while (true) {
        const int start = int(m_buffer.indexOf(QByteArrayLiteral("\xff\x09")));
        if (start < 0) {
            if (!m_buffer.endsWith(char(0xff)))
                m_buffer.clear();
            else
                m_buffer = m_buffer.right(1);
            break;
        }
        if (start > 0)
            m_buffer.remove(0, start);
        if (m_buffer.size() < 4)
            break;
        const int declared = quint8(m_buffer[2]) | (quint8(m_buffer[3]) << 8);
        if (declared < 10 || declared > 4096) {
            m_buffer.remove(0, 2);
            continue;
        }
        if (m_buffer.size() < declared)
            break;
        frames.append(m_buffer.left(declared));
        m_buffer.remove(0, declared);
    }
    return frames;
}

void PortPatch::applyTo(PortTelemetry &port) const
{
    if (outputOn)
        port.outputOn = *outputOn;
    if (power)
        port.power = *power;
    if (voltage)
        port.voltage = *voltage;
    if (current)
        port.current = *current;
    if (cableCode)
        port.cableCode = *cableCode;
    if (cable)
        port.cable = *cable;
    if (charging)
        port.charging = *charging;
}

bool RealtimeUpdate::hasPortPatch() const
{
    for (const auto &port : ports) {
        if (port)
            return true;
    }
    return false;
}

namespace {

struct TypedValue
{
    int kind = 0xff;
    std::optional<quint32> unsignedValue;
    QByteArray bytes;
};

TypedValue readTypedValue(const QByteArray &raw)
{
    TypedValue result;
    if (raw.isEmpty())
        return result;
    result.kind = quint8(raw[0]);
    result.bytes = raw.mid(1);
    const QByteArray &body = result.bytes;
    auto byteAt = [&](int i) { return quint32(quint8(body[i])); };
    if (result.kind == 0x01 && body.size() >= 1)
        result.unsignedValue = byteAt(0);
    else if (result.kind == 0x02 && body.size() >= 2)
        result.unsignedValue = byteAt(0) | (byteAt(1) << 8);
    else if (result.kind == 0x03 && body.size() >= 4)
        result.unsignedValue = byteAt(0) | (byteAt(1) << 8) | (byteAt(2) << 16) | (byteAt(3) << 24);
    return result;
}

std::optional<double> readScalar(const QMap<quint8, QByteArray> &fields, quint8 type)
{
    const auto it = fields.constFind(type);
    if (it == fields.constEnd())
        return std::nullopt;
    const TypedValue decoded = readTypedValue(*it);
    if (decoded.unsignedValue)
        return double(*decoded.unsignedValue);
    return std::nullopt;
}

std::optional<QString> cableCapability(const QString &code)
{
    if (code == QLatin1String("00"))
        return QStringLiteral("3A-60W MAX");
    if (code == QLatin1String("01"))
        return QStringLiteral("5A-100W MAX");
    if (code == QLatin1String("02"))
        return QStringLiteral("EPR-240W MAX");
    return std::nullopt;
}

std::optional<QString> chargingInfo(const QString &code)
{
    if (code == QLatin1String("01"))
        return QStringLiteral("Apple PD 快充");
    if (code == QLatin1String("02"))
        return QStringLiteral("Samsung 快充");
    if (code == QLatin1String("03"))
        return QStringLiteral("Samsung 超级快充");
    return std::nullopt;
}

void applyCable(PortPatch &patch, const QMap<quint8, QByteArray> &fields, quint8 type)
{
    const auto it = fields.constFind(type);
    if (it == fields.constEnd())
        return;
    const TypedValue decoded = readTypedValue(*it);
    const QByteArray bytes = decoded.kind == 0x04 ? decoded.bytes : *it;
    if (bytes.size() < 2)
        return;
    const QString capability = QString::asprintf("%02x", quint8(bytes[bytes.size() - 2]));
    const QString info = QString::asprintf("%02x", quint8(bytes[bytes.size() - 1]));
    patch.cableCode = (capability + info).toUpper();
    if (capability == QLatin1String("03")) {
        patch.cable = std::optional<QString>();
        patch.charging = std::optional<QString>();
        return;
    }
    patch.cable = cableCapability(capability);
    patch.charging = chargingInfo(info);
}

} // namespace

RealtimeUpdate parseRealtime(const QByteArray &payload, quint16 command)
{
    const QMap<quint8, QByteArray> fields = tlvMap(payload);
    RealtimeUpdate update;

    if (command == Command::FixedAllocation) {
        const auto fixed = readScalar(fields, 0xa2);
        if (fixed && (*fixed == 0 || *fixed == 1))
            update.fixedAllocation = int(*fixed);
    }
    if (command == Command::ChargingMode || command == 0x0303) {
        const auto mode = readScalar(fields, 0xa2);
        if (mode && (*mode == 0 || *mode == 1 || *mode == 4))
            update.chargingMode = int(*mode);
    }

    if (command == Command::Status || command == 0x0a00 || command == 0x0040 || command == 0x0405)
        return update;

    constexpr quint8 structTypes[PortCount] = {0xa5, 0xa6, 0xa7};
    constexpr quint8 cableTypes[PortCount] = {0xac, 0xad, 0xae};
    bool hasStruct = false;

    for (int i = 0; i < PortCount; ++i) {
        const auto it = fields.constFind(structTypes[i]);
        if (it == fields.constEnd())
            continue;
        const TypedValue decoded = readTypedValue(*it);
        if (decoded.kind != 0x04 || decoded.bytes.size() < 7)
            continue;
        hasStruct = true;
        const QByteArray &data = decoded.bytes;
        auto u16 = [&](int at) { return quint16(quint8(data[at]) | (quint8(data[at + 1]) << 8)); };
        PortPatch patch;
        patch.outputOn = quint8(data[0]) != 0;
        patch.voltage = std::optional<double>(u16(1) / 1000.0);
        patch.current = std::optional<double>(u16(3) / 1000.0);
        patch.power = std::optional<double>(u16(5) / 100.0);
        applyCable(patch, fields, cableTypes[i]);
        update.ports[i] = patch;
    }

    if (hasStruct) {
        double total = 0;
        for (int i = 0; i < PortCount; ++i) {
            if (!update.ports[i] || !update.ports[i]->cableCode) {
                PortPatch patch = update.ports[i].value_or(PortPatch{});
                applyCable(patch, fields, cableTypes[i]);
                update.ports[i] = patch;
            }
            if (update.ports[i]->power && *update.ports[i]->power)
                total += **update.ports[i]->power;
        }
        update.totalPower = total;
        return update;
    }

    constexpr quint8 voltageTypes[PortCount] = {0xa2, 0xa3, 0xa4};
    constexpr quint8 currentTypes[PortCount] = {0xa5, 0xa6, 0xa7};
    constexpr quint8 powerTypes[PortCount] = {0xb0, 0xb1, 0xb2};

    for (int i = 0; i < PortCount; ++i) {
        const auto voltageRaw = readScalar(fields, voltageTypes[i]);
        const auto currentRaw = readScalar(fields, currentTypes[i]);
        const auto powerRaw = readScalar(fields, powerTypes[i]);
        if (!currentRaw && !powerRaw)
            continue;
        std::optional<double> voltage = voltageRaw ? std::optional<double>(*voltageRaw / 10) : std::nullopt;
        std::optional<double> current = currentRaw ? std::optional<double>(*currentRaw / 10) : std::nullopt;
        std::optional<double> power = powerRaw;
        if (!power && voltage && current)
            power = *voltage * *current;
        PortPatch patch;
        patch.voltage = voltage;
        patch.current = current;
        patch.power = power;
        patch.outputOn = power && *power > 0.2;
        applyCable(patch, fields, cableTypes[i]);
        update.ports[i] = patch;
    }

    if (const auto total = readScalar(fields, 0xa8))
        update.totalPower = *total;
    return update;
}

DeviceIdentity extractIdentity(const QByteArray &payload)
{
    int offset = tlvOffset(payload);
    if (payload.size() > 5 && payload[0] == 0x03 && payload[1] == 0x00)
        offset = 6;

    static const QRegularExpression firmwareA(QStringLiteral("^v?\\d+(?:\\.\\d+){1,5}$"),
                                              QRegularExpression::CaseInsensitiveOption);
    static const QRegularExpression firmwareB(QStringLiteral("^v\\d"),
                                              QRegularExpression::CaseInsensitiveOption);
    static const QRegularExpression serialRe(QStringLiteral("^[A-Z0-9_-]{10,30}$"),
                                             QRegularExpression::CaseInsensitiveOption);
    static const QRegularExpression macRe(QStringLiteral("^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$"),
                                          QRegularExpression::CaseInsensitiveOption);
    static const QRegularExpression productRe(QStringLiteral("anker|prime|a2687"),
                                              QRegularExpression::CaseInsensitiveOption);
    static const QRegularExpression spaces(QStringLiteral("\\s+"));

    auto looksLikeFirmware = [&](const QString &t) { return firmwareA.match(t).hasMatch() || firmwareB.match(t).hasMatch(); };
    auto looksLikeSerial = [&](const QString &t) { return serialRe.match(t).hasMatch() && !looksLikeFirmware(t); };
    auto looksLikeProduct = [&](const QString &t) { return t.size() >= 3 && t.size() <= 40 && productRe.match(t).hasMatch(); };

    DeviceIdentity identity;
    for (const Tlv &tlv : parseTlv(payload, offset)) {
        const QString text = QString::fromLatin1(tlv.value).replace(spaces, QStringLiteral(" ")).trimmed();
        if (tlv.type == 0xa2 && looksLikeProduct(text))
            identity.productName = text;
        if (tlv.type == 0xa3 && looksLikeFirmware(text))
            identity.firmware = text;
        if (tlv.type == 0xa4 && looksLikeSerial(text))
            identity.serial = text;
        if (tlv.type == 0xa5 && tlv.value.size() >= 6) {
            QStringList parts;
            for (int i = 0; i < 6; ++i)
                parts << QString::asprintf("%02X", quint8(tlv.value[i]));
            const QString mac = parts.join(':');
            if (mac != QLatin1String("00:00:00:00:00:00"))
                identity.mac = mac;
        }
        if (identity.productName.isEmpty() && looksLikeProduct(text))
            identity.productName = text;
        if (identity.firmware.isEmpty() && looksLikeFirmware(text))
            identity.firmware = text;
        if (identity.serial.isEmpty() && looksLikeSerial(text))
            identity.serial = text;
        if (identity.mac.isEmpty() && macRe.match(text).hasMatch())
            identity.mac = QString(text).replace('-', ':').toUpper();
    }
    return identity;
}

namespace {
QByteArray typedUInt8(quint8 value)
{
    return QByteArray("\x01", 1) + char(value);
}
} // namespace

TlvList portPowerTlv(int portIndex, bool on)
{
    return {{0xa1, QByteArray("\x21", 1)},
            {0xa2, typedUInt8(quint8(portIndex))},
            {0xa3, typedUInt8(on ? 1 : 0)},
            {0xfe, timestampBytes()}};
}

TlvList portTimerTlv(int portIndex, quint32 seconds)
{
    return {{0xa1, QByteArray("\x21", 1)},
            {0xa2, typedUInt8(quint8(portIndex))},
            {0xa3, QByteArray("\x04", 1) + u32le(seconds)},
            {0xfe, timestampBytes()}};
}

TlvList singleValueTlv(quint8 value)
{
    return {{0xa1, QByteArray("\x21", 1)}, {0xa2, typedUInt8(value)}, {0xfe, timestampBytes()}};
}

TlvList realtimeTlv()
{
    return {{0xa1, QByteArray("\x21", 1)},
            {0xa2, fromHex("045553")},
            {0xa3, QByteArray("\x04", 1) + loginId()},
            {0xa5, QByteArray("\x01\x01", 2)},
            {0xfe, timestampBytes()}};
}

TlvList statusTlv()
{
    return {{0xa1, QByteArray("\x21", 1)}, {0xfe, timestampBytes()}};
}

} // namespace Anker
