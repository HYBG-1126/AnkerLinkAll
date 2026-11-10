#include "ChargerController.h"

#include <QBluetoothDeviceDiscoveryAgent>
#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QLowEnergyController>
#include <QLowEnergyService>
#include <QPermissions>
#include <QSettings>
#include <QStandardPaths>

using namespace Anker;

namespace {
const QBluetoothUuid kServiceUuid(QStringLiteral("8c850001-0302-41c5-b46e-cf057c562025"));
const QBluetoothUuid kWriteUuid(QStringLiteral("8c850002-0302-41c5-b46e-cf057c562025"));
const QBluetoothUuid kNotifyUuid(QStringLiteral("8c850003-0302-41c5-b46e-cf057c562025"));
const QBluetoothUuid kAdvertisedUuid(quint16(0xff09));

constexpr int kScanWindowMs = 8000;
constexpr int kConnectTimeoutMs = 12000;
constexpr int kRememberedConnectTimeoutMs = 15000;
constexpr int kHandshakeWatchdogMs = 25000;
constexpr int kStaleGraceMs = 20000;
constexpr int kBackoffSeconds[] = {5, 15, 30, 60, 120};
constexpr int kHistoryLimit = 48;

const char *kRememberedIdKey = "bluetooth/rememberedPeripheral";
const char *kRememberedNameKey = "bluetooth/rememberedName";

QVariant optionalValue(const std::optional<double> &value)
{
    return value ? QVariant(*value) : QVariant();
}

QVariant optionalValue(const std::optional<QString> &value)
{
    return value ? QVariant(*value) : QVariant();
}

QFile *logFile()
{
    static QFile *file = [] {
        const QString dir = QDir::homePath() + QStringLiteral("/Library/Logs");
        QDir().mkpath(dir);
        auto *f = new QFile(dir + QStringLiteral("/AnkerLinkAll-qt.log"));
        if (f->exists() && f->size() > 2 * 1024 * 1024)
            f->remove();
        f->open(QIODevice::Append | QIODevice::Text);
        return f;
    }();
    return file;
}
} // namespace

ChargerController::ChargerController(QObject *parent)
    : QObject(parent)
{
    m_retryTimer.setSingleShot(true);
    connect(&m_retryTimer, &QTimer::timeout, this, &ChargerController::scan);

    m_connectTimeout.setSingleShot(true);
    connect(&m_connectTimeout, &QTimer::timeout, this, [this] {
        log(QStringLiteral("连接超时"));
        const bool remembered = m_targetRemembered;
        teardownLink();
        if (remembered)
            startDiscovery();
        else
            scheduleRetry(QStringLiteral("连接超时"));
    });

    m_handshakeWatchdog.setSingleShot(true);
    connect(&m_handshakeWatchdog, &QTimer::timeout, this, [this] {
        if (m_session.isReady())
            return;
        onLinkLost(QStringLiteral("会话建立超时"));
    });

    m_staleTimer.setSingleShot(true);
    connect(&m_staleTimer, &QTimer::timeout, this, [this] {
        if (!m_session.isReady()) {
            clearDeviceData();
            setState(QStringLiteral("waiting"), QStringLiteral("正在寻找充电器…"));
        }
    });

    m_writeTimer.setSingleShot(true);
    connect(&m_writeTimer, &QTimer::timeout, this, &ChargerController::flushWrites);

    connect(&m_session, &AnkerSession::send, this, &ChargerController::queueWrite);
    connect(&m_session, &AnkerSession::logMessage, this, &ChargerController::log);
    connect(&m_session, &AnkerSession::identityReceived, this, [this](const DeviceIdentity &identity) {
        if (!identity.productName.isEmpty())
            m_identity.productName = identity.productName;
        if (!identity.serial.isEmpty())
            m_identity.serial = identity.serial;
        if (!identity.firmware.isEmpty())
            m_identity.firmware = identity.firmware;
        if (!identity.mac.isEmpty())
            m_identity.mac = identity.mac;
        emit deviceChanged();
    });
    connect(&m_session, &AnkerSession::telemetryReceived, this, &ChargerController::applyTelemetry);
    connect(&m_session, &AnkerSession::phaseChanged, this,
            [this](AnkerSession::Phase phase, const QString &message) {
                switch (phase) {
                case AnkerSession::Phase::Ready:
                    m_handshakeWatchdog.stop();
                    m_staleTimer.stop();
                    m_reconnecting = false;
                    m_missCount = 0;
                    setState(QStringLiteral("ready"), message);
                    break;
                case AnkerSession::Phase::Handshaking:
                    setState(QStringLiteral("handshaking"), message);
                    break;
                case AnkerSession::Phase::Error:
                    onLinkLost(message);
                    break;
                case AnkerSession::Phase::Idle:
                    emit stateChanged();
                    break;
                }
            });
}

ChargerController::~ChargerController()
{
    m_userDisconnected = true;
    teardownLink();
}

void ChargerController::start()
{
    log(QStringLiteral("AnkerLinkAll (Qt) 启动"));
    requestPermissionThenScan();
}

void ChargerController::requestPermissionThenScan()
{
#if QT_CONFIG(permissions)
    QBluetoothPermission permission;
    permission.setCommunicationModes(QBluetoothPermission::Access);
    switch (qApp->checkPermission(permission)) {
    case Qt::PermissionStatus::Undetermined:
        setState(QStringLiteral("permission"), QStringLiteral("正在请求蓝牙权限…"));
        qApp->requestPermission(permission, this, [this](const QPermission &result) {
            if (result.status() == Qt::PermissionStatus::Granted) {
                m_permissionGranted = true;
                scan();
            } else {
                setState(QStringLiteral("denied"),
                         QStringLiteral("未获得蓝牙权限，请在“系统设置 > 隐私与安全性 > 蓝牙”中允许 AnkerLinkAll"));
            }
        });
        return;
    case Qt::PermissionStatus::Denied:
        setState(QStringLiteral("denied"),
                 QStringLiteral("未获得蓝牙权限，请在“系统设置 > 隐私与安全性 > 蓝牙”中允许 AnkerLinkAll"));
        return;
    case Qt::PermissionStatus::Granted:
        break;
    }
#endif
    m_permissionGranted = true;
    scan();
}

void ChargerController::scan()
{
    if (m_userDisconnected || !m_permissionGranted || m_controller)
        return;
    m_retryTimer.stop();
    if (m_agent && m_agent->isActive())
        return;

    QSettings settings;
    const QString remembered = settings.value(kRememberedIdKey).toString();
    if (!remembered.isEmpty()) {
        QBluetoothDeviceInfo info(QBluetoothUuid(remembered),
                                  settings.value(kRememberedNameKey).toString(), 0);
        info.setCoreConfigurations(QBluetoothDeviceInfo::LowEnergyCoreConfiguration);
        m_targetRemembered = true;
        connectTo(info, QStringLiteral("已记住的设备"));
        return;
    }
    startDiscovery();
}

void ChargerController::startDiscovery()
{
    if (m_userDisconnected || m_controller)
        return;
    if (!m_agent) {
        m_agent = new QBluetoothDeviceDiscoveryAgent(this);
        connect(m_agent, &QBluetoothDeviceDiscoveryAgent::deviceDiscovered, this,
                &ChargerController::onDeviceDiscovered);
        connect(m_agent, &QBluetoothDeviceDiscoveryAgent::deviceUpdated, this,
                [this](const QBluetoothDeviceInfo &info, QBluetoothDeviceInfo::Fields) {
                    onDeviceDiscovered(info);
                });
        auto windowEnded = [this] {
            if (m_controller || m_userDisconnected)
                return;
            log(QStringLiteral("扫描窗口结束，未发现充电器"));
            scheduleRetry(QStringLiteral("未发现充电器"));
        };
        connect(m_agent, &QBluetoothDeviceDiscoveryAgent::finished, this, windowEnded);
        connect(m_agent, &QBluetoothDeviceDiscoveryAgent::errorOccurred, this,
                [this](QBluetoothDeviceDiscoveryAgent::Error error) {
                    if (error == QBluetoothDeviceDiscoveryAgent::PoweredOffError) {
                        setState(QStringLiteral("bluetoothOff"), QStringLiteral("蓝牙已关闭，请打开蓝牙"));
                        m_retryTimer.start(5000);
                        return;
                    }
                    if (error == QBluetoothDeviceDiscoveryAgent::MissingPermissionsError) {
                        setState(QStringLiteral("denied"), QStringLiteral("未获得蓝牙权限"));
                        return;
                    }
                    log(QStringLiteral("扫描出错：%1").arg(m_agent->errorString()));
                    scheduleRetry(QStringLiteral("扫描出错"));
                });
    }
    m_nearby.clear();
    emit nearbyChanged();
    m_agent->setLowEnergyDiscoveryTimeout(kScanWindowMs);
    if (!m_reconnecting)
        setState(QStringLiteral("scanning"), QStringLiteral("正在扫描附近的安克充电器…"));
    log(QStringLiteral("开始扫描 %1 秒（按 FF09 服务与名称匹配）").arg(kScanWindowMs / 1000));
    m_agent->start(QBluetoothDeviceDiscoveryAgent::LowEnergyMethod);
}

bool ChargerController::looksLikeA2687(const QBluetoothDeviceInfo &info) const
{
    if (info.serviceUuids().contains(kAdvertisedUuid) || info.serviceUuids().contains(kServiceUuid))
        return true;
    if (info.serviceIds().contains(kAdvertisedUuid))
        return true;
    const QString name = info.name().toLower();
    return name == QLatin1String("charging") || name.startsWith(QLatin1String("ashd"))
           || name.contains(QLatin1String("anker")) || name.contains(QLatin1String("a2687"));
}

void ChargerController::onDeviceDiscovered(const QBluetoothDeviceInfo &info)
{
    if (!(info.coreConfigurations() & QBluetoothDeviceInfo::LowEnergyCoreConfiguration))
        return;
    if (!info.name().isEmpty()) {
        bool replaced = false;
        for (auto &known : m_nearby) {
            if (known.deviceUuid() == info.deviceUuid()) {
                known = info;
                replaced = true;
            }
        }
        if (!replaced)
            m_nearby.append(info);
        emit nearbyChanged();
    }
    if (m_controller || !looksLikeA2687(info))
        return;
    log(QStringLiteral("匹配到 %1（RSSI %2）").arg(info.name()).arg(info.rssi()));
    m_agent->stop();
    remember(info);
    m_targetRemembered = false;
    connectTo(info, QStringLiteral("扫描"));
}

void ChargerController::remember(const QBluetoothDeviceInfo &info)
{
    QSettings settings;
    settings.setValue(kRememberedIdKey, info.deviceUuid().toString(QUuid::WithoutBraces));
    settings.setValue(kRememberedNameKey, info.name());
}

void ChargerController::connectTo(const QBluetoothDeviceInfo &info, const QString &source)
{
    teardownLink();
    m_target = info;
    log(QStringLiteral("正在连接 %1（%2，%3）")
            .arg(info.name().isEmpty() ? QStringLiteral("未命名设备") : info.name(), source,
                 info.deviceUuid().toString(QUuid::WithoutBraces)));
    if (!m_reconnecting)
        setState(QStringLiteral("connecting"), QStringLiteral("正在连接充电器…"));

    m_controller = QLowEnergyController::createCentral(info, this);
    connect(m_controller, &QLowEnergyController::connected, this, &ChargerController::onControllerConnected);
    connect(m_controller, &QLowEnergyController::discoveryFinished, this,
            &ChargerController::onServicesDiscovered);
    connect(m_controller, &QLowEnergyController::disconnected, this,
            [this] { onLinkLost(QStringLiteral("充电器已断开")); });
    connect(m_controller, &QLowEnergyController::errorOccurred, this,
            [this](QLowEnergyController::Error error) {
                const QString reason = m_controller ? m_controller->errorString() : QString();
                const bool established = m_hasDevice && m_sessionStarted;
                if (established) {
                    onLinkLost(QStringLiteral("蓝牙错误：%1").arg(reason));
                    return;
                }
                log(QStringLiteral("连接失败（%1）：%2").arg(int(error)).arg(reason));
                const bool remembered = m_targetRemembered;
                teardownLink();
                if (remembered && error == QLowEnergyController::UnknownRemoteDeviceError)
                    startDiscovery();
                else
                    scheduleRetry(QStringLiteral("连接失败"));
            });
    m_connectTimeout.start(m_targetRemembered ? kRememberedConnectTimeoutMs : kConnectTimeoutMs);
    m_controller->connectToDevice();
}

void ChargerController::onControllerConnected()
{
    m_connectTimeout.stop();
    m_missCount = 0;
    m_advertisedName = m_target.name();
    m_hasDevice = true;
    emit deviceChanged();
    log(QStringLiteral("蓝牙链路已建立，正在发现服务"));
    if (!m_reconnecting)
        setState(QStringLiteral("discovering"), QStringLiteral("正在读取充电器服务…"));
    m_handshakeWatchdog.start(kHandshakeWatchdogMs);
    m_controller->discoverServices();
}

void ChargerController::onServicesDiscovered()
{
    if (!m_controller)
        return;
    m_service = m_controller->createServiceObject(kServiceUuid, this);
    if (!m_service) {
        log(QStringLiteral("未找到安克私有服务，设备可能不是 A2687"));
        onLinkLost(QStringLiteral("未找到安克服务"));
        return;
    }
    connect(m_service, &QLowEnergyService::stateChanged, this, &ChargerController::onServiceStateChanged);
    connect(m_service, &QLowEnergyService::characteristicChanged, this,
            [this](const QLowEnergyCharacteristic &characteristic, const QByteArray &value) {
                if (characteristic.uuid() != kNotifyUuid)
                    return;
                for (const QByteArray &frame : m_decoder.append(value))
                    m_session.handleNotification(frame);
            });
    connect(m_service, &QLowEnergyService::characteristicWritten, this, [this] {
        m_awaitingWriteAck = false;
        flushWrites();
    });
    connect(m_service, &QLowEnergyService::descriptorWritten, this, [this] {
        if (!m_sessionStarted)
            startSession();
    });
    connect(m_service, &QLowEnergyService::errorOccurred, this, [this](QLowEnergyService::ServiceError error) {
        log(QStringLiteral("GATT 服务错误：%1").arg(int(error)));
        if (error == QLowEnergyService::CharacteristicWriteError) {
            m_awaitingWriteAck = false;
            flushWrites();
        }
    });
    m_service->discoverDetails();
}

void ChargerController::onServiceStateChanged()
{
    if (!m_service || m_service->state() != QLowEnergyService::RemoteServiceDiscovered)
        return;
    m_writeChar = m_service->characteristic(kWriteUuid);
    m_notifyChar = m_service->characteristic(kNotifyUuid);
    if (!m_writeChar.isValid() || !m_notifyChar.isValid()) {
        onLinkLost(QStringLiteral("安克服务缺少读写特征值"));
        return;
    }
    enableNotifications();
}

void ChargerController::enableNotifications()
{
    const QLowEnergyDescriptor cccd =
        m_notifyChar.descriptor(QBluetoothUuid::DescriptorType::ClientCharacteristicConfiguration);
    if (cccd.isValid())
        m_service->writeDescriptor(cccd, QLowEnergyCharacteristic::CCCDEnableNotification);
    QTimer::singleShot(1500, this, [this, service = m_service] {
        if (service && service == m_service && !m_sessionStarted)
            startSession();
    });
}

void ChargerController::startSession()
{
    m_sessionStarted = true;
    m_decoder.reset();
    m_session.start();
}

void ChargerController::onLinkLost(const QString &reason)
{
    if (!m_controller && !m_session.isReady() && m_session.phase() == AnkerSession::Phase::Idle)
        return;
    const bool hadDevice = m_hasDevice;
    log(QStringLiteral("连接中断：%1").arg(reason));
    teardownLink();
    if (m_userDisconnected)
        return;
    if (hadDevice) {
        m_reconnecting = true;
        m_staleTimer.start(kStaleGraceMs);
        setState(QStringLiteral("reconnecting"), QStringLiteral("与充电器的连接中断，正在自动重连…"));
        m_targetRemembered = true;
        scheduleRetry(reason, 1000);
    } else {
        scheduleRetry(reason);
    }
}

void ChargerController::scheduleRetry(const QString &reason, int overrideMs)
{
    if (m_userDisconnected)
        return;
    const int count = int(std::size(kBackoffSeconds));
    const int delayMs = overrideMs >= 0 ? overrideMs : kBackoffSeconds[qMin(m_missCount, count - 1)] * 1000;
    if (overrideMs < 0)
        ++m_missCount;
    log(QStringLiteral("%1，%2 秒后重试").arg(reason).arg(delayMs / 1000.0, 0, 'f', delayMs < 1000 ? 1 : 0));
    if (m_reconnecting)
        emit stateChanged();
    else
        setState(QStringLiteral("waiting"), QStringLiteral("未找到充电器，%1 秒后自动重试").arg(delayMs / 1000));
    m_retryTimer.start(delayMs);
}

void ChargerController::teardownLink()
{
    m_connectTimeout.stop();
    m_handshakeWatchdog.stop();
    m_writeTimer.stop();
    m_pendingWrites.clear();
    m_awaitingWriteAck = false;
    m_sessionStarted = false;
    m_decoder.reset();
    m_session.stop();
    m_writeChar = {};
    m_notifyChar = {};
    if (m_service) {
        m_service->disconnect(this);
        m_service->deleteLater();
        m_service = nullptr;
    }
    if (m_controller) {
        QLowEnergyController *controller = m_controller;
        m_controller = nullptr;
        controller->disconnect(this);
        controller->disconnectFromDevice();
        controller->deleteLater();
    }
}

void ChargerController::clearDeviceData()
{
    m_hasDevice = false;
    m_reconnecting = false;
    m_advertisedName.clear();
    m_identity = {};
    for (auto &port : m_ports)
        port = {};
    m_totalPower.reset();
    m_chargingMode = -1;
    m_hasTelemetry = false;
    m_history.clear();
    emit deviceChanged();
    emit telemetryChanged();
    emit stateChanged();
}

void ChargerController::queueWrite(const QByteArray &frame)
{
    m_pendingWrites.append(frame);
    flushWrites();
}

void ChargerController::flushWrites()
{
    if (!m_service || !m_writeChar.isValid() || m_pendingWrites.isEmpty() || m_awaitingWriteAck
        || m_writeTimer.isActive())
        return;
    const QByteArray frame = m_pendingWrites.takeFirst();
    if (m_writeChar.properties() & QLowEnergyCharacteristic::WriteNoResponse) {
        m_service->writeCharacteristic(m_writeChar, frame, QLowEnergyService::WriteWithoutResponse);
        if (!m_pendingWrites.isEmpty())
            m_writeTimer.start(12);
    } else {
        m_awaitingWriteAck = true;
        m_service->writeCharacteristic(m_writeChar, frame, QLowEnergyService::WriteWithResponse);
    }
}

void ChargerController::applyTelemetry(const RealtimeUpdate &update)
{
    const bool hasPortPatch = update.hasPortPatch();
    for (int i = 0; i < PortCount; ++i) {
        if (update.ports[i])
            update.ports[i]->applyTo(m_ports[i]);
    }
    if (update.totalPower) {
        m_totalPower = update.totalPower;
    } else if (hasPortPatch) {
        std::optional<double> sum;
        for (const auto &port : m_ports) {
            if (port.power)
                sum = sum.value_or(0) + *port.power;
        }
        m_totalPower = sum;
    }
    if (update.chargingMode)
        m_chargingMode = *update.chargingMode;
    if (update.totalPower) {
        m_history.append(*update.totalPower);
        while (m_history.size() > kHistoryLimit)
            m_history.removeFirst();
    }
    if (hasPortPatch || update.totalPower)
        m_hasTelemetry = true;
    emit telemetryChanged();
}

QString ChargerController::deviceName() const
{
    if (!m_identity.productName.isEmpty())
        return m_identity.productName;
    return m_advertisedName;
}

QString ChargerController::displayName() const
{
    if (!m_hasDevice)
        return QString();
    if (model() == QLatin1String("A2687"))
        return QStringLiteral("160W Prime Charger");
    return deviceName();
}

QVariantList ChargerController::ports() const
{
    QVariantList list;
    for (int i = 0; i < PortCount; ++i) {
        const PortTelemetry &port = m_ports[i];
        const bool plugged = port.cableCode ? !port.cableCode->startsWith(QLatin1String("03"))
                                            : port.power.value_or(0) > 0.2;
        list.append(QVariantMap{
            {QStringLiteral("id"), QStringLiteral("C%1").arg(i + 1)},
            {QStringLiteral("index"), i},
            {QStringLiteral("outputOn"), port.outputOn},
            {QStringLiteral("plugged"), m_hasTelemetry && plugged},
            {QStringLiteral("power"), optionalValue(port.power)},
            {QStringLiteral("voltage"), optionalValue(port.voltage)},
            {QStringLiteral("current"), optionalValue(port.current)},
            {QStringLiteral("cable"), optionalValue(port.cable)},
            {QStringLiteral("charging"), optionalValue(port.charging)},
        });
    }
    return list;
}

QVariant ChargerController::totalPower() const
{
    return optionalValue(m_totalPower);
}

QVariantList ChargerController::nearbyDevices() const
{
    QVariantList list;
    for (const auto &info : m_nearby) {
        list.append(QVariantMap{
            {QStringLiteral("name"), info.name()},
            {QStringLiteral("uuid"), info.deviceUuid().toString(QUuid::WithoutBraces)},
            {QStringLiteral("rssi"), info.rssi()},
            {QStringLiteral("anker"), looksLikeA2687(info)},
        });
    }
    return list;
}

void ChargerController::connectNow()
{
    if (m_controller)
        return;
    m_userDisconnected = false;
    m_missCount = 0;
    m_retryTimer.stop();
    if (!m_permissionGranted) {
        requestPermissionThenScan();
        return;
    }
    scan();
}

void ChargerController::scanNow()
{
    if (!m_controller)
        connectNow();
}

void ChargerController::connectToNearby(const QString &uuid)
{
    for (const auto &info : std::as_const(m_nearby)) {
        if (info.deviceUuid().toString(QUuid::WithoutBraces) != uuid)
            continue;
        m_userDisconnected = false;
        m_retryTimer.stop();
        if (m_agent)
            m_agent->stop();
        remember(info);
        m_targetRemembered = false;
        connectTo(info, QStringLiteral("手动选择"));
        return;
    }
}

void ChargerController::disconnectDevice()
{
    m_userDisconnected = true;
    m_retryTimer.stop();
    m_staleTimer.stop();
    if (m_agent)
        m_agent->stop();
    teardownLink();
    clearDeviceData();
    setState(QStringLiteral("idle"), QStringLiteral("已断开连接"));
    log(QStringLiteral("用户断开连接"));
}

void ChargerController::forgetDevice()
{
    disconnectDevice();
    QSettings settings;
    settings.remove(kRememberedIdKey);
    settings.remove(kRememberedNameKey);
    log(QStringLiteral("已忘记设备"));
}

bool ChargerController::setPortPower(int portIndex, bool on)
{
    return portIndex >= 0 && portIndex < PortCount && m_session.setPortPower(portIndex, on);
}

bool ChargerController::setPortTimer(int portIndex, int seconds)
{
    return portIndex >= 0 && portIndex < PortCount && seconds >= 0
           && m_session.setPortTimer(portIndex, quint32(seconds));
}

bool ChargerController::setChargingMode(int mode)
{
    return (mode == 0 || mode == 1 || mode == 4) && m_session.setChargingMode(mode);
}

bool ChargerController::setSetting(const QString &kind, int value)
{
    static const QHash<QString, quint16> commands{
        {QStringLiteral("language"), Command::Language},
        {QStringLiteral("screenTimeout"), Command::ScreenTimeout},
        {QStringLiteral("brightness"), Command::ScreenBrightness},
        {QStringLiteral("screenDirection"), Command::ScreenDirection},
    };
    const auto it = commands.constFind(kind);
    if (it == commands.constEnd() || value < 0 || value > 255)
        return false;
    return m_session.sendSetting(*it, quint8(value));
}

void ChargerController::setState(const QString &state, const QString &text)
{
    m_state = state;
    m_statusText = text;
    emit stateChanged();
}

void ChargerController::log(const QString &message)
{
    const QString line = QDateTime::currentDateTime().toString(QStringLiteral("HH:mm:ss.zzz ")) + message;
    m_logs.append(line);
    while (m_logs.size() > 300)
        m_logs.removeFirst();
    if (QFile *file = logFile(); file->isOpen()) {
        file->write(line.toUtf8() + '\n');
        file->flush();
    }
    emit logsChanged();
}
