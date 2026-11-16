#include "ChargerController.h"
#include "MacUtils.h"

#include <QApplication>
#include <QDir>
#include <QElapsedTimer>
#include <QIcon>
#include <QLockFile>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QScreen>
#include <QSettings>
#include <QSystemTrayIcon>
#include <QTimer>

namespace {

void showPanel(QQuickWindow *window, const QSystemTrayIcon &tray)
{
    const QRect anchor = tray.geometry();
    QScreen *screen = anchor.isValid() ? QGuiApplication::screenAt(anchor.center()) : nullptr;
    if (!screen)
        screen = QGuiApplication::primaryScreen();
    const QRect available = screen->availableGeometry();
    int x = anchor.isValid() ? anchor.center().x() - window->width() / 2 : available.right() - window->width() - 12;
    int y = anchor.isValid() ? anchor.bottom() + 6 : available.top() + 6;
    x = qBound(available.left() + 8, x, available.right() - window->width() - 8);
    y = qMax(y, available.top() + 4);
    window->setPosition(x, y);
    window->show();
    window->raise();
    MacUtils::presentPanel(window);
    window->requestActivate();
}

} // namespace

// 项目由 AnkerLinkAll 改名而来，首次启动时沿用旧偏好（记住的充电器、自定义名称等）
static void migrateLegacySettings()
{
    QSettings current;
    const QString flag = QStringLiteral("migration/fromAnkerLinkAll");
    if (current.value(flag).toBool())
        return;
    QSettings legacy(QStringLiteral("hybg.com"), QStringLiteral("AnkerLinkAll"));
    legacy.setFallbacksEnabled(false);
    for (const QString &key : legacy.allKeys()) {
        if (!current.contains(key))
            current.setValue(key, legacy.value(key));
    }
    current.setValue(flag, true);
}

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    QApplication::setApplicationName(QStringLiteral("AnkerLinker"));
    QApplication::setApplicationVersion(QStringLiteral(APP_VERSION));
    QApplication::setOrganizationName(QStringLiteral("AnkerLinker"));
    QApplication::setOrganizationDomain(QStringLiteral("hybg.com"));
    QApplication::setQuitOnLastWindowClosed(false);
    QQuickStyle::setStyle(QStringLiteral("Basic"));

    QLockFile lock(QDir::tempPath() + QStringLiteral("/AnkerLinker-qt.lock"));
    lock.setStaleLockTime(0);
    if (!lock.tryLock(100))
        return 0;

    migrateLegacySettings();
    ChargerController charger;
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("charger"), &charger);
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(1); }, Qt::QueuedConnection);
    engine.loadFromModule("AnkerLinker", "Main");
    if (engine.rootObjects().isEmpty())
        return 1;
    auto *window = qobject_cast<QQuickWindow *>(engine.rootObjects().constFirst());

    QSystemTrayIcon tray;
    QIcon icon;
    icon.addFile(QStringLiteral(":/qt/qml/AnkerLinker/assets/trayTemplate.png"));
    icon.addFile(QStringLiteral(":/qt/qml/AnkerLinker/assets/trayTemplate@2x.png"));
    icon.setIsMask(true);
    tray.setIcon(icon);
    tray.setToolTip(QStringLiteral("AnkerLinker"));

    const bool pinned = qEnvironmentVariableIsSet("ANKER_PIN");
    // 点击托盘图标时面板会先失焦隐藏，避免紧接着的点击事件又把它重新打开
    QElapsedTimer sinceAutoHide;
    QObject::connect(&tray, &QSystemTrayIcon::activated, window, [&](QSystemTrayIcon::ActivationReason) {
        if (window->isVisible())
            window->hide();
        else if (!sinceAutoHide.isValid() || sinceAutoHide.elapsed() > 300)
            showPanel(window, tray);
    });
    QObject::connect(window, &QWindow::activeChanged, window, [&] {
        if (!pinned && !window->isActive() && window->isVisible()) {
            window->hide();
            sinceAutoHide.start();
        }
    });
    QObject::connect(window, SIGNAL(quitRequested()), &app, SLOT(quit()));

    auto updateTooltip = [&] {
        QString text = QStringLiteral("AnkerLinker");
        if (charger.sessionReady() && charger.totalPower().isValid())
            text += QStringLiteral(" · %1 W").arg(charger.totalPower().toDouble(), 0, 'f', 1);
        else if (!charger.statusText().isEmpty())
            text += QStringLiteral(" · ") + charger.statusText();
        tray.setToolTip(text);
    };
    QObject::connect(&charger, &ChargerController::telemetryChanged, &tray, updateTooltip);
    QObject::connect(&charger, &ChargerController::stateChanged, &tray, updateTooltip);

    tray.show();
    charger.start();
    QTimer::singleShot(400, window, [&] { showPanel(window, tray); });

    return app.exec();
}
