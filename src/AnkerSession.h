#pragma once

#include "AnkerCrypto.h"
#include "AnkerProtocol.h"

#include <QObject>
#include <QSet>
#include <QTimer>
#include <functional>
#include <memory>

class AnkerSession : public QObject
{
    Q_OBJECT

public:
    enum class Phase { Idle, Handshaking, Ready, Error };

    explicit AnkerSession(QObject *parent = nullptr);

    Phase phase() const { return m_phase; }
    bool isReady() const { return m_phase == Phase::Ready; }

    void start();
    void stop();
    void handleNotification(const QByteArray &bytes);

    bool setPortPower(int portIndex, bool on);
    bool setPortTimer(int portIndex, quint32 seconds);
    bool setChargingMode(int mode);
    bool sendSetting(quint16 command, quint8 value);

signals:
    void send(const QByteArray &frame);
    void phaseChanged(AnkerSession::Phase phase, const QString &message);
    void identityReceived(const Anker::DeviceIdentity &identity);
    void telemetryReceived(const Anker::RealtimeUpdate &update);
    void logMessage(const QString &message);

private:
    enum Step { StepConnect, StepCapability, StepDeviceInfo, StepSetCapability, StepPublicKey, StepDone };

    void runStep(Step step);
    void handleHandshakeResponse(quint16 command, const QByteArray &plain);
    void finishHandshake();
    void fail(const QString &reason);
    void sendCommand(quint8 group, quint16 command, const Anker::TlvList &tlvs);
    void requestTelemetry();
    void requestStatus();
    void after(int ms, std::function<void()> action);
    std::optional<QByteArray> decrypt(const QByteArray &body) const;

    Phase m_phase = Phase::Idle;
    Step m_step = StepConnect;
    quint16 m_expected = 0;
    bool m_acceptAny = false;
    quint64 m_generation = 0;
    QByteArray m_key;
    QByteArray m_nonce;
    QByteArray m_handshakeTimestamp;
    std::unique_ptr<AnkerCrypto::EcdhKeyPair> m_keyPair;
    QTimer m_responseTimeout;
    QTimer m_heartbeat;
    int m_heartbeatTick = 0;
    int m_frameCount = 0;
    int m_telemetryCount = 0;
    QSet<QString> m_seenCommands;
};
