import { Card, CardContent } from "@/components/ui/card";

interface WelcomeCardProps {
  name?: string | null;
  description: string;
}

/** Greeting banner at the top of every role's dashboard. */
export function WelcomeCard({ name, description }: WelcomeCardProps) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col gap-2 p-6 md:px-6 md:py-7">
        <h1 className="text-[26px] font-bold leading-tight text-foreground max-[480px]:text-[22px]">
          Welcome back{name ? `, ${name}` : ""}
        </h1>
        <p className="max-w-[480px] text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
