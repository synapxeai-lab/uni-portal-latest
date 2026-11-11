/**
 * Side-effect-only barrel: importing this module registers every built-in
 * calendar event provider (each file below calls registerCalendarEventProvider
 * at module load). calendar-service.ts imports this once, which guarantees
 * providers are registered before getEvents() can ever run, regardless of
 * what else in the app happens to import calendar-service first.
 */
import "./assignment-due-date-provider";
import "./scheduled-content-provider";
import "./classroom-events-provider";
