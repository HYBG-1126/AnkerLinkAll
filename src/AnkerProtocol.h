#pragma once

#include <QByteArray>
#include <QList>
#include <QMap>
#include <QString>
#include <optional>

namespace Anker {

inline constexpr int PortCount = 3;

namespace Command {
inline constexpr quint16 Connect = 0x0001;
inline constexpr quint16 Capability = 0x0003;
inline constexpr quint16 SetCapability = 0x0005;
inline constexpr quint16 PublicKey = 0x0021;
inline constexpr quint16 AesKey = 0x0022;
inline constexpr quint16 UserAuth = 0x0027;
inline constexpr quint16 DeviceInfo = 0x0029;
inline constexpr quint16 Status = 0x0200;
inline constexpr quint16 Language = 0x0202;
inline constexpr quint16 ScreenTimeout = 0x0203;
inline constexpr quint16 ScreenBrightness = 0x0204;
inline constexpr quint16 FixedAllocation = 0x0205;
inline constexpr quint16 ChargingMode = 0x0206;
inline constexpr quint16 PortSwitch = 0x0207;
inline constexpr quint16 PortTimer = 0x0209;
inline constexpr quint16 Realtime = 0x020A;
inline constexpr quint16 ScreenDirection = 0x020B;
} // namespace Command

QByteArray fromHex(const char *hex);
QByteArray aad();
QByteArray initialKey();
QByteArray initialNonce();
QByteArray loginId();

QByteArray u32le(quint32 value);
QByteArray timestampBytes();

struct Tlv
{
    quint8 type;
    QByteArray value;
};
using TlvList = QList<Tlv>;

QByteArray buildTlv(const TlvList &tlvs);
TlvList parseTlv(const QByteArray &payload, int offset = 0);
int tlvOffset(const QByteArray &payload);
QMap<quint8, QByteArray> tlvMap(const QByteArray &payload);

QByteArray buildFrame(const QByteArray &payload);

struct Frame
{
    QByteArray header;
    QByteArray body;
    quint16 command = 0;
    bool encrypted = false;
};
std::optional<Frame> parseFrame(const QByteArray &frame);

class FrameStreamDecoder
{
public:
    QList<QByteArray> append(const QByteArray &chunk);
    void reset() { m_buffer.clear(); }

private:
    QByteArray m_buffer;
};

struct PortTelemetry
{
    bool outputOn = false;
    std::optional<double> power;
    std::optional<double> voltage;
    std::optional<double> current;
    std::optional<QString> cableCode;
    std::optional<QString> cable;
    std::optional<QString> charging;
};

struct PortPatch
{
    std::optional<bool> outputOn;
    std::optional<std::optional<double>> power;
    std::optional<std::optional<double>> voltage;
    std::optional<std::optional<double>> current;
    std::optional<QString> cableCode;
    std::optional<std::optional<QString>> cable;
    std::optional<std::optional<QString>> charging;

    void applyTo(PortTelemetry &port) const;
};

struct RealtimeUpdate
{
    std::optional<PortPatch> ports[PortCount];
    std::optional<double> totalPower;
    std::optional<int> chargingMode;
    std::optional<int> fixedAllocation;

    bool hasPortPatch() const;
};

RealtimeUpdate parseRealtime(const QByteArray &payload, quint16 command);

struct DeviceIdentity
{
    QString productName;
    QString serial;
    QString firmware;
    QString mac;
};
DeviceIdentity extractIdentity(const QByteArray &payload);

TlvList portPowerTlv(int portIndex, bool on);
TlvList portTimerTlv(int portIndex, quint32 seconds);
TlvList singleValueTlv(quint8 value);
TlvList realtimeTlv();
TlvList statusTlv();

} // namespace Anker
