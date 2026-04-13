import Cocoa

final class HostMenuController: NSObject {
  private let startupLoginController: StartupLoginController
  private var statusItem: NSStatusItem?
  private var launchAtLoginMenuItem: NSMenuItem?

  init(startupLoginController: StartupLoginController) {
    self.startupLoginController = startupLoginController
  }

  func installMenu() {
    let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    statusItem.button?.title = "Codewall"

    let menu = NSMenu()

    let launchAtLoginItem = NSMenuItem(
      title: "Launch at Login",
      action: #selector(toggleLaunchAtLogin),
      keyEquivalent: ""
    )
    launchAtLoginItem.target = self
    launchAtLoginItem.state = startupLoginController.launchAtLoginEnabled ? .on : .off
    menu.addItem(launchAtLoginItem)

    menu.addItem(.separator())

    let quitItem = NSMenuItem(title: "Quit Codewall", action: #selector(quitApp), keyEquivalent: "q")
    quitItem.target = self
    menu.addItem(quitItem)

    statusItem.menu = menu

    self.statusItem = statusItem
    self.launchAtLoginMenuItem = launchAtLoginItem
  }

  @objc
  private func toggleLaunchAtLogin() {
    guard let launchAtLoginMenuItem else {
      return
    }

    let nextValue = launchAtLoginMenuItem.state != .on
    let updated = startupLoginController.setLaunchAtLogin(enabled: nextValue)

    if updated {
      launchAtLoginMenuItem.state = nextValue ? .on : .off
    }
  }

  @objc
  private func quitApp() {
    NSApplication.shared.terminate(nil)
  }
}
