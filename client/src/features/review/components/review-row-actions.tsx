import { useState } from "react";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ReviewQueueRow } from "../types";
import { ReviewDetailDialog } from "./review-detail-dialog";

export function ReviewRowActions({ row }: { row: ReviewQueueRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eye className="h-3.5 w-3.5" /> Open
      </Button>
      <ReviewDetailDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}
