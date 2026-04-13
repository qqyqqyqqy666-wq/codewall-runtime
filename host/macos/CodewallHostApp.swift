import Cocoa

@main
final class CodewallHostApp: NSObject, NSApplicationDelegate {
  private let startupLoginController = StartupLoginController()
  private lazy var hostMenuController = HostMenuController(startupLoginController: startupLoginController)
  private var desktopDisplayCoordinator: DesktopDisplayCoordinator?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSLog("[CodewallHost][Diag] applicationDidFinishLaunching: screens=%ld windows(before)=%ld",
          NSScreen.screens.count,
          NSApp.windows.count)
    NSApp.setActivationPolicy(.accessory)
    startupLoginController.applyStartupPolicy()
    hostMenuController.installMenu()
    let coordinator = DesktopDisplayCoordinator(bundle: .main)
    coordinator.start()
    desktopDisplayCoordinator = coordinator
    NSLog("[CodewallHost][Diag] applicationDidFinishLaunching complete: windows(after)=%ld", NSApp.windows.count)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
  }
}
