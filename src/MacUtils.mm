#include "MacUtils.h"

#import <AppKit/AppKit.h>

#include <QWindow>
#include <QDebug>

namespace MacUtils {

void activateApp()
{
    [NSApp activateIgnoringOtherApps:YES];
}

// 作为 accessory 应用无法靠 activate 抢焦点，必须手动把窗口提到浮动层级并强制前置
void presentPanel(QWindow *window)
{
    NSView *view = reinterpret_cast<NSView *>(window->winId());
    NSWindow *nsWindow = [view window];
    if (!nsWindow)
        return;
    [nsWindow setLevel:NSStatusWindowLevel];
    [nsWindow setCollectionBehavior:NSWindowCollectionBehaviorMoveToActiveSpace
                                   | NSWindowCollectionBehaviorFullScreenAuxiliary
                                   | NSWindowCollectionBehaviorTransient];
    [NSApp activateIgnoringOtherApps:YES];
    [nsWindow orderFrontRegardless];
}

} // namespace MacUtils
