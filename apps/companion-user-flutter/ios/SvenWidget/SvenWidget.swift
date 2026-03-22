import SwiftUI
import WidgetKit

private let kAppGroupId = "group.com.fortyseven.thesven.widget"
private let kLastMessage = "sven_last_message"
private let kUsername = "sven_username"
private let kUpdatedAt = "sven_updated_at"

struct SvenEntry: TimelineEntry {
    let date: Date
    let lastMessage: String
    let username: String
    let updatedAt: String
}

struct SvenProvider: TimelineProvider {
    func placeholder(in context: Context) -> SvenEntry {
        SvenEntry(
            date: Date(),
            lastMessage: "Open Sven to start chatting...",
            username: "",
            updatedAt: ""
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SvenEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SvenEntry>) -> Void) {
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [entry()], policy: .after(nextUpdate)))
    }

    private func entry() -> SvenEntry {
        let defaults = UserDefaults(suiteName: kAppGroupId)
        return SvenEntry(
            date: Date(),
            lastMessage: defaults?.string(forKey: kLastMessage) ?? "Open Sven to start chatting...",
            username: defaults?.string(forKey: kUsername) ?? "",
            updatedAt: defaults?.string(forKey: kUpdatedAt) ?? ""
        )
    }
}

struct SvenWidgetEntryView: View {
    var entry: SvenProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            accessoryCircularView
        case .accessoryRectangular:
            accessoryRectangularView
        default:
            mainView
        }
    }

    private var mainView: some View {
        ZStack {
            Color(red: 0.016, green: 0.027, blue: 0.071)
                .clipShape(RoundedRectangle(cornerRadius: 20))

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Sven")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Color(red: 0, green: 0.851, blue: 1))

                    Spacer()

                    if !entry.updatedAt.isEmpty {
                        Text(entry.updatedAt)
                            .font(.system(size: 10))
                            .foregroundColor(.white.opacity(0.5))
                    }
                }

                Divider().background(Color.white.opacity(0.1))

                Text(entry.lastMessage)
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.85))
                    .lineSpacing(3)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer()

                if !entry.username.isEmpty {
                    Text(entry.username)
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.4))
                }
            }
            .padding(14)
        }
        .widgetURL(URL(string: "sven://widget/voice"))
    }

    private var accessoryCircularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image(systemName: "brain.head.profile")
                .font(.system(size: 22, weight: .medium))
                .foregroundColor(Color(red: 0, green: 0.851, blue: 1))
        }
        .widgetURL(URL(string: "sven://widget/voice"))
    }

    private var accessoryRectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Sven", systemImage: "brain.head.profile")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(Color(red: 0, green: 0.851, blue: 1))

            Text(entry.lastMessage)
                .font(.system(size: 11))
                .lineLimit(2)
                .foregroundColor(.white.opacity(0.85))
        }
        .widgetURL(URL(string: "sven://widget/voice"))
    }
}

struct SvenWidget: Widget {
    let kind: String = "SvenWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SvenProvider()) { entry in
            SvenWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Sven")
        .description("See your latest Sven AI message at a glance.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
        ])
    }
}

#Preview(as: .systemMedium) {
    SvenWidget()
} timeline: {
    SvenEntry(
        date: Date(),
        lastMessage: "Sure. Here is a quick summary of your day.",
        username: "Ada",
        updatedAt: "3:42 PM"
    )
}
