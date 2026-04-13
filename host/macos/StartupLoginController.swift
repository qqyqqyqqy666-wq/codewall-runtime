import Cocoa
import ServiceManagement

final class StartupLoginController {
  private static let launchAtLoginDefaultsKey = "codewall.launchAtLoginEnabled"

  var launchAtLoginEnabled: Bool {
    UserDefaults.standard.object(forKey: Self.launchAtLoginDefaultsKey) as? Bool ?? true
  }

  func applyStartupPolicy() {
    _ = setLaunchAtLogin(enabled: launchAtLoginEnabled)
  }

  @discardableResult
  func setLaunchAtLogin(enabled: Bool) -> Bool {
    UserDefaults.standard.set(enabled, forKey: Self.launchAtLoginDefaultsKey)

    guard #available(macOS 13.0, *) else {
      NSLog("[CodewallHost] Launch-at-login requires macOS 13+.")
      return false
    }

    do {
      if enabled {
        try SMAppService.mainApp.register()
      } else {
        try SMAppService.mainApp.unregister()
      }

      return true
    } catch {
      NSLog("[CodewallHost] Failed to update launch-at-login: \(error.localizedDescription)")
      return false
    }
  }
}
