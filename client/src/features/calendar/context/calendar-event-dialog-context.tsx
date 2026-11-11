import * as React from "react";

import type { CalendarEvent } from "../types";

interface CalendarEventDialogContextValue {
  selectedEvent: CalendarEvent | null;
  openEvent: (event: CalendarEvent) => void;
  closeEvent: () => void;
}

const CalendarEventDialogContext = React.createContext<CalendarEventDialogContextValue | null>(
  null,
);

/**
 * Owns which event's details dialog is open, mirroring the
 * SearchDialogProvider pattern - mounted once at the /calendar page level so
 * every event chip/row across the grid views and the sidebar (Today,
 * Upcoming, Monthly agenda) opens the same single dialog instance instead of
 * each row managing its own.
 */
export function CalendarEventDialogProvider({ children }: { children: React.ReactNode }) {
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);

  const openEvent = React.useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const closeEvent = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const value = React.useMemo(
    () => ({ selectedEvent, openEvent, closeEvent }),
    [selectedEvent, openEvent, closeEvent],
  );

  return (
    <CalendarEventDialogContext.Provider value={value}>
      {children}
    </CalendarEventDialogContext.Provider>
  );
}

export function useCalendarEventDialog() {
  const context = React.useContext(CalendarEventDialogContext);
  if (!context) {
    throw new Error("useCalendarEventDialog must be used within a CalendarEventDialogProvider");
  }
  return context;
}
