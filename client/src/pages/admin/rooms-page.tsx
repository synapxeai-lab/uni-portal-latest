import { useState, useTransition } from "react";
import { DoorOpen, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import {
  createRoomAction,
  deleteRoomAction,
  setRoomActiveAction,
  useRooms,
  type RoomRow,
} from "@/features/timetable/api";
import { ROOM_FORMAT_MESSAGE, isValidRoom, sanitizeRoomInput } from "@/features/timetable/lib/slots";

type Pending = { kind: "deactivate" | "delete"; room: RoomRow } | null;

/**
 * Rooms: the rows of the shared timetable and the only rooms teachers can book.
 * Add a room by its 3-digit number, take one out of use, or delete one that
 * was never booked.
 */
export default function RoomsPage() {
  const rooms = useRooms();
  const [number, setNumber] = useState("");
  const [isAdding, startAdd] = useTransition();
  const [pending, setPending] = useState<Pending>(null);
  const [isWorking, startWork] = useTransition();
  const valid = isValidRoom(number);

  function add() {
    if (!valid) {
      return;
    }
    startAdd(async () => {
      const result = await createRoomAction(number);
      if (result.status === "success") {
        toast.success(result.data.message);
        setNumber("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function reactivate(room: RoomRow) {
    startWork(async () => {
      const result = await setRoomActiveAction(room.id, true);
      if (result.status === "success") {
        toast.success(`Room ${room.number} is back in use.`);
      } else {
        toast.error(result.message);
      }
    });
  }

  function confirmPending() {
    if (!pending) {
      return;
    }
    const { kind, room } = pending;
    startWork(async () => {
      const result = kind === "delete" ? await deleteRoomAction(room.id) : await setRoomActiveAction(room.id, false);
      if (result.status === "success") {
        toast.success(kind === "delete" ? `Room ${room.number} deleted.` : `Room ${room.number} is out of use.`);
        setPending(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <QueryView query={rooms} loading={<AdminLoading />}>
      {({ rooms: list }) => {
        const active = list.filter((r) => r.isActive).length;
        return (
          <PageContainer>
            <SectionHeader
              title="Rooms"
              description="The teaching rooms on the timetable. Teachers can only book rooms that are in use."
              breadcrumbs={[{ label: "Rooms" }]}
            />

            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="room-number">Add a room</Label>
                <Input
                  id="room-number"
                  value={number}
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="e.g. 305"
                  onChange={(event) => setNumber(sanitizeRoomInput(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") add();
                  }}
                />
                <p className={`text-xs ${number && !valid ? "text-destructive" : "text-muted-foreground"}`}>
                  {number && !valid ? ROOM_FORMAT_MESSAGE : "3 digits: the first is the floor (305 = floor 3, room 05)."}
                </p>
              </div>
              <Button onClick={add} disabled={!valid || isAdding} className="sm:mb-6">
                <Plus aria-hidden /> {isAdding ? "Adding…" : "Add room"}
              </Button>
            </Card>

            {list.length === 0 ? (
              <EmptyState icon={DoorOpen} title="No rooms yet" description="Add the first teaching room above." />
            ) : (
              <Card className="overflow-x-auto p-0">
                <p className="px-4 pt-3 text-sm text-muted-foreground">
                  {list.length} rooms · {active} in use
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Classes / week</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-semibold">{room.number}</TableCell>
                        <TableCell>{room.floor}</TableCell>
                        <TableCell>{room.weeklyClasses}</TableCell>
                        <TableCell>
                          {room.isActive ? (
                            <Badge variant="success">In use</Badge>
                          ) : (
                            <Badge variant="secondary">Out of use</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {room.isActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                // A booked room has to be emptied first (its classes moved elsewhere).
                                disabled={isWorking || room.weeklyClasses > 0}
                                title={
                                  room.weeklyClasses > 0
                                    ? "Move this room's classes to other rooms first"
                                    : undefined
                                }
                                onClick={() => setPending({ kind: "deactivate", room })}
                              >
                                Take out of use
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled={isWorking} onClick={() => reactivate(room)}>
                                Put back in use
                              </Button>
                            )}
                            {room.weeklyClasses === 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isWorking}
                                className="text-destructive hover:text-destructive"
                                onClick={() => setPending({ kind: "delete", room })}
                              >
                                Delete
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            <ConfirmDialog
              open={pending !== null}
              onOpenChange={(open) => !open && setPending(null)}
              title={pending?.kind === "delete" ? `Delete Room ${pending.room.number}?` : `Take Room ${pending?.room.number} out of use?`}
              description={
                pending?.kind === "delete"
                  ? "It's removed from the timetable for good. Only rooms with no classes booked can be deleted."
                  : "It disappears from the timetable and teachers can't book it until you put it back in use."
              }
              confirmLabel={pending?.kind === "delete" ? "Delete room" : "Take out of use"}
              destructive={pending?.kind === "delete"}
              pending={isWorking}
              onConfirm={confirmPending}
            />
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
