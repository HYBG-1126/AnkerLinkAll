cmake_minimum_required(VERSION 3.21)

project(AnkerLinker VERSION 0.1.0 LANGUAGES CXX OBJCXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET 13.0)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Widgets Qml Quick QuickControls2 Bluetooth Svg)
qt_standard_project_setup(REQUIRES 6.5)

set(OPENSSL_ROOT /opt/homebrew/opt/openssl@3 CACHE PATH "OpenSSL 3 prefix")

qt_add_executable(AnkerLinker MACOSX_BUNDLE
    src/main.cpp
    src/AnkerCrypto.cpp src/AnkerCrypto.h
    src/AnkerProtocol.cpp src/AnkerProtocol.h
    src/AnkerSession.cpp src/AnkerSession.h
    src/ChargerController.cpp src/ChargerController.h
    src/MacUtils.mm src/MacUtils.h
    assets/icon.icns
)

set_source_files_properties(qml/App.qml PROPERTIES QT_QML_SINGLETON_TYPE TRUE)

qt_add_qml_module(AnkerLinker
    URI AnkerLinker
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/App.qml
        qml/DevicesPage.qml
        qml/ProfilePage.qml
        qml/DevicePage.qml
        qml/SettingsPage.qml
        qml/RealtimePage.qml
        qml/LogsPage.qml
        qml/DeviceCables.qml
        qml/Icon.qml
        qml/Card.qml
        qml/OptionSheet.qml
        qml/Sparkline.qml
        qml/ListRow.qml
        qml/PageHeader.qml
    RESOURCES
        assets/anker-logo.svg
        assets/device-a2687.png
        assets/device-a2687-thumb.png
        assets/cable-c1.png
        assets/cable-c2.png
        assets/cable-c3.png
        assets/trayTemplate.png
        assets/trayTemplate@2x.png
)

set_source_files_properties(assets/icon.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)

set_target_properties(AnkerLinker PROPERTIES
    OUTPUT_NAME AnkerLinker
    MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_SOURCE_DIR}/cmake/Info.plist.in
    MACOSX_BUNDLE_GUI_IDENTIFIER com.hybg.anker-linker
    MACOSX_BUNDLE_BUNDLE_NAME AnkerLinker
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION}
    MACOSX_BUNDLE_ICON_FILE icon.icns
)

target_include_directories(AnkerLinker PRIVATE ${OPENSSL_ROOT}/include)
target_compile_definitions(AnkerLinker PRIVATE APP_VERSION="${PROJECT_VERSION}")
target_link_libraries(AnkerLinker PRIVATE
    Qt6::Core Qt6::Gui Qt6::Widgets Qt6::Qml Qt6::Quick Qt6::QuickControls2 Qt6::Bluetooth Qt6::Svg
    ${OPENSSL_ROOT}/lib/libcrypto.a
    "-framework AppKit"
)
