import WidgetKit
import SwiftUI
import AppIntents

let appGroup = "group.com.justin.expensetracker"

// MARK: - Privacy toggle intent (runs in-place when the eye is tapped)

struct TogglePrivacyIntent: AppIntent {
  static var title: LocalizedStringResource = "Toggle Privacy"
  static var description = IntentDescription("Hide or show spending amounts on the widget.")

  func perform() async throws -> some IntentResult {
    let defaults = UserDefaults(suiteName: appGroup)
    let hidden = defaults?.bool(forKey: "widgetHidden") ?? false
    defaults?.set(!hidden, forKey: "widgetHidden")
    return .result()
  }
}

// MARK: - Timeline

struct SpendEntry: TimelineEntry {
  let date: Date
  let today: Double
  let month: Double
  let hidden: Bool
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SpendEntry {
    SpendEntry(date: Date(), today: 21.10, month: 246.10, hidden: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (SpendEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SpendEntry>) -> Void) {
    let current = loadEntry()
    var entries = [current]

    // Pre-schedule a midnight entry so "Today" resets to $0 without the app opening.
    let cal = Calendar.current
    if let midnight = cal.nextDate(
      after: Date(),
      matching: DateComponents(hour: 0, minute: 0),
      matchingPolicy: .nextTime
    ) {
      let sameMonth = cal.isDate(midnight, equalTo: Date(), toGranularity: .month)
      entries.append(SpendEntry(
        date: midnight,
        today: 0,
        month: sameMonth ? current.month : 0,
        hidden: current.hidden
      ))
    }

    completion(Timeline(entries: entries, policy: .atEnd))
  }

  private func loadEntry() -> SpendEntry {
    let defaults = UserDefaults(suiteName: appGroup)
    let hidden = defaults?.bool(forKey: "widgetHidden") ?? false

    guard
      let json = defaults?.string(forKey: "widgetData"),
      let data = json.data(using: .utf8),
      let parsed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    else {
      return SpendEntry(date: Date(), today: 0, month: 0, hidden: hidden)
    }

    let today = (parsed["today"] as? NSNumber)?.doubleValue ?? 0
    let month = (parsed["month"] as? NSNumber)?.doubleValue ?? 0

    // Zero out figures whose period has passed since the app last wrote them.
    var isSameDay = true
    var isSameMonth = true
    if let written = parsed["date"] as? String {
      let fmt = ISO8601DateFormatter()
      fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      if let writtenDate = fmt.date(from: written) ?? ISO8601DateFormatter().date(from: written) {
        isSameDay = Calendar.current.isDateInToday(writtenDate)
        isSameMonth = Calendar.current.isDate(writtenDate, equalTo: Date(), toGranularity: .month)
      }
    }

    return SpendEntry(
      date: Date(),
      today: isSameDay ? today : 0,
      month: isSameMonth ? month : 0,
      hidden: hidden
    )
  }
}

// MARK: - Views

func money(_ value: Double, hidden: Bool) -> String {
  hidden ? "$••••" : String(format: "$%.2f", value)
}

struct StatBlock: View {
  let label: String
  let amount: Double
  let hidden: Bool
  var large: Bool = true

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label)
        .font(.system(size: 10, weight: .medium))
        .kerning(1.2)
        .foregroundColor(Color(white: 0.55))
      Text(money(amount, hidden: hidden))
        .font(.system(size: large ? 26 : 15, weight: large ? .light : .regular))
        .foregroundColor(.white)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
    }
  }
}

struct EyeButton: View {
  let hidden: Bool

  var body: some View {
    Button(intent: TogglePrivacyIntent()) {
      Image(systemName: hidden ? "eye.slash" : "eye")
        .font(.system(size: 12))
        .foregroundColor(Color(white: 0.45))
    }
    .buttonStyle(.plain)
  }
}

struct SpendWidgetView: View {
  var entry: SpendEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      if family == .systemMedium {
        HStack(alignment: .center) {
          StatBlock(label: "TODAY", amount: entry.today, hidden: entry.hidden)
          Spacer()
          StatBlock(label: "THIS MONTH", amount: entry.month, hidden: entry.hidden)
        }
        .padding(.horizontal, 4)
      } else {
        VStack(alignment: .leading) {
          StatBlock(label: "TODAY", amount: entry.today, hidden: entry.hidden)
          Spacer()
          StatBlock(label: "THIS MONTH", amount: entry.month, hidden: entry.hidden, large: false)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .overlay(alignment: .topTrailing) {
      EyeButton(hidden: entry.hidden)
    }
    .containerBackground(for: .widget) { Color.black }
  }
}

struct SpendWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SpendWidget", provider: Provider()) { entry in
      SpendWidgetView(entry: entry)
    }
    .configurationDisplayName("Spending")
    .description("Today and this month at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct SeriesExpenseWidgets: WidgetBundle {
  var body: some Widget {
    SpendWidget()
  }
}
