#pragma once

#include "AnkerProtocol.h"
#include "AnkerSession.h"

#include <QBluetoothDeviceInfo>
#include <QLowEnergyCharacteristic>
#include <QObject>
#include <QPointer>
#include <QTimer>
#include <QVariant>

class QBluetoothDeviceDiscoveryAgent;
class QLowEnergyController;
class QLowEnergyService;

class ChargerController : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString connectionState READ connectionState NOTIFY stateChanged)
    Q_PROPERTY(QString statusText READ statusText NOTIFY stateChanged)
    Q_PROPERTY(bool linked READ linked NOTIFY stateChanged)
    Q_PROPERTY(bool sessionReady READ sessionReady NOTIFY stateChanged)
    Q_PROPERTY(bool reconnecting READ reconnecting NOTIFY stateChanged)
    Q_PROPERTY(bool hasDevice READ hasDevice NOTIFY deviceChanged)
    Q_PROPERTY(QString deviceName READ deviceName NOTIFY deviceChanged)
    Q_PROPERTY(QString displayName READ displayName NOTIFY deviceChanged)
    Q_PROPERTY(QString serial READ serial NOTIFY deviceChanged)
    Q_PROPERTY(QString firmware READ firmware NOTIFY deviceChanged)
    Q_PROPERTY(QString mac READ mac NOTIFY deviceChanged)
    Q_PROPERTY(QString model READ model NOTIFY deviceChanged)
    Q_PROPERTY(QVariantList ports READ ports NOTIFY telemetryChanged)
    Q_PROPERTY(QVariant totalPower READ totalPower NOTIFY telemetryChanged)
    Q_PROPERTY(QVariantList history READ history NOTIFY telemetryChanged)
    Q_PROPERTY(int chargingMode READ chargingMode NOTIFY telemetryChanged)
    Q_PROPERTY(bool hasTelemetry READ hasTelemetry NOTIFY telemetryChanged)
    Q_PROPERTY(QVariantList nearbyDevices READ nearbyDevices NOTIFY nearbyChanged)
    Q_PROPERTY(QStringList logs READ logs NOTIFY logsChanged)

public:
    explicit ChargerController(QObject *parent = nullptr);
    ~ChargerController() override;

    void start();

    QString connectionState() const { return m_state; }
    QString statusText() const { return m_statusText; }
    bool linked() const { return m_session.phase() != AnkerSession::Phase::Idle; }
    bool sessionReady() const { return m_session.isReady(); }
    bool reconnecting() const { return m_reconnecting; }
    bool hasDevice() const { return m_hasDevice; }
    QString deviceName() const;
    QString displayName() const;
    QString serial() const { return m_identity.serial; }
    QString firmware() const { return m_identity.firmware; }
    QString mac() const { return m_identity.mac; }
    QString model() const { return m_hasDevice ? QStringLiteral("A2687") : QString(); }
    QVariantList ports() const;
    QVariant totalPower() const;
    QVariantList history() const { return m_history; }
    int chargingMode() const { return m_chargingMode; }
    bool hasTelemetry() const { return m_hasTelemetry; }
    QVariantList nearbyDevices() const;
    QStringList logs() const { return m_logs; }

    Q_INVOKABLE void connectNow();
    Q_INVOKABLE void scanNow();
    Q_INVOKABLE void connectToNearby(const QString &uuid);
    Q_INVOKABLE void disconnectDevice();
    Q_INVOKABLE void forgetDevice();
    Q_INVOKABLE bool setPortPower(int portIndex, bool on);
    Q_INVOKABLE bool setPortTimer(int portIndex, int seconds);
    Q_INVOKABLE bool setChargingMode(int mode);
    Q_INVOKABLE bool setSetting(const QString &kind, int value);

signals:
    void stateChanged();
    void deviceChanged();
    void telemetryChanged();
    void nearbyChanged();
    void logsChanged();

private:
    void requestPermissionThenScan();
    void scan();
    void startDiscovery();
    void onDeviceDiscovered(const QBluetoothDeviceInfo &info);
    bool looksLikeA2687(const QBluetoothDeviceInfo &info) const;
    void connectTo(const QBluetoothDeviceInfo &info, const QString &source);
    void onControllerConnected();
    void onServicesDiscovered();
    void onServiceStateChanged();
    void enableNotifications();
    void startSession();
    void onLinkLost(const QString &reason);
    void scheduleRetry(const QString &reason, int overrideMs = -1);
    void teardownLink();
    void clearDeviceData();
    void queueWrite(const QByteArray &frame);
    void flushWrites();
    void applyTelemetry(const Anker::RealtimeUpdate &update);
    void setState(const QString &state, const QString &text);
    void log(const QString &message);
    void remember(const QBluetoothDeviceInfo &info);

    AnkerSession m_session;
    Anker::FrameStreamDecoder m_decoder;
    QBluetoothDeviceDiscoveryAgent *m_agent = nullptr;
    QPointer<QLowEnergyController> m_controller;
    QPointer<QLowEnergyService> m_service;
    QLowEnergyCharacteristic m_writeChar;
    QLowEnergyCharacteristic m_notifyChar;
    QBluetoothDeviceInfo m_target;
    bool m_targetRemembered = false;

    QTimer m_retryTimer;
    QTimer m_connectTimeout;
    QTimer m_handshakeWatchdog;
    QTimer m_staleTimer;
    QTimer m_writeTimer;
    QList<QByteArray> m_pendingWrites;
    bool m_awaitingWriteAck = false;
    bool m_sessionStarted = false;

    bool m_permissionGranted = false;
    bool m_userDisconnected = false;
    bool m_reconnecting = false;
    int m_missCount = 0;
    QString m_state = QStringLiteral("idle");
    QString m_statusText;

    bool m_hasDevice = false;
    QString m_advertisedName;
    Anker::DeviceIdentity m_identity;
    Anker::PortTelemetry m_ports[Anker::PortCount];
    std::optional<double> m_totalPower;
    int m_chargingMode = -1;
    bool m_hasTelemetry = false;
    QVariantList m_history;
    QList<QBluetoothDeviceInfo> m_nearby;
    QStringList m_logs;
};
