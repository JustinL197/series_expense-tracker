import ExpoModulesCore
import WidgetKit

public class WidgetSyncModule: Module {
  private let appGroup = "group.com.justin.expensetracker"

  public func definition() -> ModuleDefinition {
    Name("WidgetSync")

    Function("setWidgetData") { (json: String) in
      let defaults = UserDefaults(suiteName: self.appGroup)
      defaults?.set(json, forKey: "widgetData")
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("clearWidgetData") {
      let defaults = UserDefaults(suiteName: self.appGroup)
      defaults?.removeObject(forKey: "widgetData")
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
