import Cocoa

@main
final class CodewallHostApp: NSObject, NSApplicationDelegate {
  private let startupLoginController = StartupLoginController()
  private lazy var hostMenuController = HostMenuController(startupLoginController: startupLoginController)
  private var desktopDisplayCoordinator: DesktopDisplayCoordinator?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
    startupLoginController.applyStartupPolicy()
    hostMenuController.installMenu()
    let coordinator = DesktopDisplayCoordinator(bundle: .main)
    coordinator.start()
    desktopDisplayCoordinator = coordinator
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
  }
}
