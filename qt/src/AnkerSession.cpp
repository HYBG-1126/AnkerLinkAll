#include "AnkerSession.h"

#include <QSet>

using namespace Anker;

namespace {
constexpr int kResponseTimeoutMs = 6000;
constexpr int kHeartbeatMs = 6000;

QString hex4(quint16 value)
{
    return QStringLiteral("0x%1").arg(value, 4, 16, QLatin1Char('0'));
}
} // namespace

AnkerSession::AnkerSession(QObject *parent)
    : QObject(parent)
{
    m_responseTimeout.setSingleShot(true);
    connect(&m_responseTimeout, &QTimer::timeout, this, [this] {
        fail(QStringLiteral("等待设备响应 %1 超时").arg(hex4(m_expected)));
    });
    m_heartbeat.setInterval(kHeartbeatMs);
    connect(&m_heartbeat, &QTimer::timeout, this, [this] {
        if (!isReady())
            return;
        ++m_heartbeatTick;
        if (m_heartbeatTick % 5 == 1)
            emit logMessage(QStringLiteral("A2687：心跳 #%1，累计收到 %2 帧，解析出遥测 %3 次")
                                .arg(m_heartbeatTick).arg(m_frameCount).arg(m_telemetryCount));
        requestTelemetry();
        if (m_heartbeatTick % 2 == 0)
            requestStatus();
    });
}

void AnkerSession::start()
{
    stop();
    m_phase = Phase::Handshaking;
    m_key = initialKey();
    m_nonce = initialNonce();
    m_keyPair = std::make_unique<AnkerCrypto::EcdhKeyPair>();
    if (!m_keyPair->isValid() || m_keyPair->publicCoordinates().size() != 64) {
        fail(QStringLiteral("无法生成 P-256 客户端密钥"));
        return;
    }
    m_handshakeTimestamp = timestampBytes();
    emit phaseChanged(m_phase, QStringLiteral("正在建立安克安全会话…"));
    emit logMessage(QStringLiteral("A2687：开始 AES-GCM / ECDH 会话握手"));
    runStep(StepConnect);
}

void AnkerSession::stop()
{
    ++m_generation;
    m_responseTimeout.stop();
    m_heartbeat.stop();
    m_key.clear();
    m_nonce.clear();
    m_keyPair.reset();
    m_expected = 0;
    m_frameCount = 0;
    m_telemetryCount = 0;
    m_seenCommands.clear();
    if (m_phase != Phase::Idle) {
        m_phase = Phase::Idle;
        emit phaseChanged(m_phase, QStringLiteral("尚未连接安克设备"));
    }
}

void AnkerSession::after(int ms, std::function<void()> action)
{
    const quint64 generation = m_generation;
    QTimer::singleShot(ms, this, [this, generation, action = std::move(action)] {
        if (generation == m_generation)
            action();
    });
}

void AnkerSession::runStep(Step step)
{
    m_step = step;
    const QByteArray ts = m_handshakeTimestamp;
    auto expect = [this](quint16 command, bool any) {
        m_expected = command;
        m_acceptAny = any;
        m_responseTimeout.start(kResponseTimeoutMs);
    };
    switch (step) {
    case StepConnect:
        expect(Command::Connect, true);
        sendCommand(0x01, Command::Connect, {{0xa1, ts}});
        break;
    case StepCapability:
        expect(Command::Capability, true);
        sendCommand(0x01, Command::Capability,
                    {{0xa1, ts}, {0xa3, QByteArray("\x20", 1)}, {0xa4, QByteArray("\x00\xf0", 2)}});
        break;
    case StepDeviceInfo:
        expect(Command::DeviceInfo, false);
        sendCommand(0x01, Command::DeviceInfo, {{0xa1, ts}});
        break;
    case StepSetCapability:
        expect(Command::SetCapability, true);
        sendCommand(0x01, Command::SetCapability,
                    {{0xa1, timestampBytes()},
                     {0xa3, QByteArray("\x20", 1)},
                     {0xa4, QByteArray("\x29\x01", 2)},
                     {0xa5, QByteArray("\x44", 1)},
                     {0xa6, QByteArray("\x02", 1)}});
        break;
    case StepPublicKey:
        expect(Command::PublicKey, false);
        sendCommand(0x01, Command::PublicKey, {{0xa1, m_keyPair->publicCoordinates()}});
        break;
    case StepDone:
        break;
    }
}

void AnkerSession::handleHandshakeResponse(quint16 command, const QByteArray &plain)
{
    if (!m_acceptAny && command != m_expected)
        return;
    m_responseTimeout.stop();
    switch (m_step) {
    case StepConnect:
        after(100, [this] { runStep(StepCapability); });
        break;
    case StepCapability:
        after(100, [this] { runStep(StepDeviceInfo); });
        break;
    case StepDeviceInfo: {
        const DeviceIdentity identity = extractIdentity(plain);
        if (!identity.productName.isEmpty())
            emit logMessage(QStringLiteral("A2687：设备型号 %1").arg(identity.productName));
        if (!identity.serial.isEmpty())
            emit logMessage(QStringLiteral("A2687：设备序列号 %1").arg(identity.serial));
        emit identityReceived(identity);
        after(100, [this] { runStep(StepSetCapability); });
        break;
    }
    case StepSetCapability:
        after(120, [this] { runStep(StepPublicKey); });
        break;
    case StepPublicKey: {
        QByteArray device;
        for (const Tlv &tlv : parseTlv(plain, tlvOffset(plain))) {
            if (tlv.type == 0xa1 && tlv.value.size() == 64)
                device = tlv.value;
        }
        if (device.isEmpty()) {
            fail(QStringLiteral("设备公钥格式无效"));
            return;
        }
        const auto shared = m_keyPair->sharedSecret(device);
        if (!shared) {
            fail(QStringLiteral("ECDH 共享密钥派生失败"));
            return;
        }
        m_key = shared->left(16);
        m_nonce = shared->mid(16, 12);
        m_step = StepDone;
        emit logMessage(QStringLiteral("A2687：已通过 ECDH 派生会话密钥"));
        after(120, [this] { finishHandshake(); });
        break;
    }
    case StepDone:
        break;
    }
}

void AnkerSession::finishHandshake()
{
    sendCommand(0x01, Command::AesKey,
                {{0xa1, timestampBytes()},
                 {0xa3, fromHex("808fffff")},
                 {0xa5, QByteArray("CST-8")}});
    after(120, [this] {
        sendCommand(0x01, Command::UserAuth, {{0xa1, timestampBytes()}, {0xa2, loginId()}});
        after(150, [this] {
            m_phase = Phase::Ready;
            emit phaseChanged(m_phase, QStringLiteral("安克会话已建立，正在读取实时数据"));
            emit logMessage(QStringLiteral("A2687：安全会话建立完成，开始接收真实遥测"));
            requestStatus();
            requestTelemetry();
            m_heartbeatTick = 0;
            m_heartbeat.start();
            after(800, [this] {
                sendCommand(0x0f, 0x020c,
                            {{0xa1, QByteArray("\x21", 1)}, {0xa2, QByteArray("\x01\x00", 2)}, {0xfe, timestampBytes()}});
            });
        });
    });
}

void AnkerSession::fail(const QString &reason)
{
    ++m_generation;
    m_responseTimeout.stop();
    m_heartbeat.stop();
    m_phase = Phase::Error;
    emit logMessage(QStringLiteral("A2687：会话握手失败：%1").arg(reason));
    emit phaseChanged(m_phase, QStringLiteral("安克会话握手失败：%1").arg(reason));
}

void AnkerSession::sendCommand(quint8 group, quint16 command, const TlvList &tlvs)
{
    if (m_key.isEmpty())
        return;
    const QByteArray cipher = AnkerCrypto::aesGcmEncrypt(buildTlv(tlvs), m_key, m_nonce, aad());
    if (cipher.isEmpty()) {
        emit logMessage(QStringLiteral("A2687：加密 %1 失败").arg(hex4(command)));
        return;
    }
    QByteArray payload;
    payload.append(char(0x03));
    payload.append(char(0x00));
    payload.append(char(group));
    payload.append(char(((command >> 8) & 0xff) | 0x40));
    payload.append(char(command & 0xff));
    payload.append(cipher);
    emit send(buildFrame(payload));
}

std::optional<QByteArray> AnkerSession::decrypt(const QByteArray &body) const
{
    if (auto plain = AnkerCrypto::aesGcmDecrypt(body, m_key, m_nonce, aad()))
        return plain;
    // 部分固件的多段上报会多带一个前缀字节
    if (body.size() > 17)
        return AnkerCrypto::aesGcmDecrypt(body.mid(1), m_key, m_nonce, aad());
    return std::nullopt;
}

void AnkerSession::handleNotification(const QByteArray &bytes)
{
    if (m_phase == Phase::Idle || m_key.isEmpty())
        return;
    const auto frame = parseFrame(bytes);
    if (!frame)
        return;

    const QString key = QStringLiteral("%1:%2").arg(frame->command).arg(frame->encrypted);
    const bool firstSeen = !m_seenCommands.contains(key);
    if (firstSeen) {
        m_seenCommands.insert(key);
        emit logMessage(QStringLiteral("A2687：收到 %1（%2 字节，%3）")
                            .arg(hex4(frame->command))
                            .arg(frame->body.size())
                            .arg(frame->encrypted ? QStringLiteral("加密") : QStringLiteral("明文")));
    }

    QByteArray plain;
    // v0.0.5.2 固件的会话上报不带加密标志位但仍是 AES-GCM 密文，先尝试解密再按明文解析
    if (const auto decrypted = decrypt(frame->body)) {
        plain = *decrypted;
    } else if (frame->encrypted) {
        if (firstSeen)
            emit logMessage(QStringLiteral("A2687：%1 解密失败").arg(hex4(frame->command)));
        return;
    } else {
        plain = frame->body;
    }
    ++m_frameCount;
    if (frame->command == Command::AesKey || frame->command == Command::UserAuth)
        emit logMessage(QStringLiteral("A2687：%1 回包 %2").arg(hex4(frame->command), QString::fromLatin1(plain.toHex())));

    if (m_phase == Phase::Handshaking) {
        if (m_expected != 0 && m_responseTimeout.isActive())
            handleHandshakeResponse(frame->command, plain);
        return;
    }
    if (m_phase != Phase::Ready)
        return;

    const quint16 command = frame->command;
    const bool relevant = command == 0x0300 || command == Command::Realtime || command == Command::Status
                          || command == Command::FixedAllocation || command == Command::ChargingMode
                          || command == 0x0303 || command == 0x0a00 || command == 0x0040
                          || command == 0x0405 || command == 0x0410;
    if (!relevant)
        return;
    const RealtimeUpdate update = parseRealtime(plain, command);
    if (!update.hasPortPatch() && !update.totalPower && !update.chargingMode && !update.fixedAllocation)
        return;
    if (m_telemetryCount++ == 0)
        emit logMessage(QStringLiteral("A2687：首次解析出遥测（%1）").arg(hex4(command)));
    emit telemetryReceived(update);
}

void AnkerSession::requestTelemetry()
{
    if (isReady())
        sendCommand(0x0f, Command::Realtime, realtimeTlv());
}

void AnkerSession::requestStatus()
{
    if (isReady())
        sendCommand(0x0f, Command::Status, statusTlv());
}

bool AnkerSession::setPortPower(int portIndex, bool on)
{
    if (!isReady())
        return false;
    sendCommand(0x0f, Command::PortSwitch, portPowerTlv(portIndex, on));
    emit logMessage(QStringLiteral("A2687：C%1 输出%2指令已发送").arg(portIndex + 1).arg(on ? "开启" : "关闭"));
    after(200, [this] {
        requestStatus();
        requestTelemetry();
    });
    return true;
}

bool AnkerSession::setPortTimer(int portIndex, quint32 seconds)
{
    if (!isReady())
        return false;
    sendCommand(0x0f, Command::PortTimer, portTimerTlv(portIndex, seconds));
    emit logMessage(QStringLiteral("A2687：C%1 定时已设为 %2 分钟").arg(portIndex + 1).arg(seconds / 60));
    return true;
}

bool AnkerSession::setChargingMode(int mode)
{
    if (!isReady())
        return false;
    sendCommand(0x0f, Command::ChargingMode, singleValueTlv(quint8(mode)));
    RealtimeUpdate update;
    update.chargingMode = mode;
    emit telemetryReceived(update);
    emit logMessage(QStringLiteral("A2687：充电模式已切换为 %1").arg(mode));
    after(200, [this] { requestStatus(); });
    return true;
}

bool AnkerSession::sendSetting(quint16 command, quint8 value)
{
    if (!isReady())
        return false;
    sendCommand(0x0f, command, singleValueTlv(value));
    emit logMessage(QStringLiteral("A2687：设置 %1 = %2 已发送").arg(hex4(command)).arg(value));
    return true;
}
