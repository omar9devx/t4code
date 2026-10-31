import { MessageSquareDashedIcon, PlusIcon } from "lucide-react";

import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { Button } from "./ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { SidebarInset } from "./ui/sidebar";
import { isElectron } from "../env";
import { WorkspacePageHeader } from "./WorkspacePageHeader";

export function NoActiveThreadState() {
  const { defaultProjectRef, handleNewThread } = useHandleNewThread();

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <WorkspacePageHeader electron={isElectron} className="border-b border-border">
          {isElectron ? (
            <span className="text-xs text-muted-foreground/50">No active thread</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
                No active thread
              </span>
            </div>
          )}
        </WorkspacePageHeader>

        <Empty size="hero" className="flex-1">
          <EmptyMedia variant="icon">
            <MessageSquareDashedIcon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Ready when you are</EmptyTitle>
            <EmptyDescription>
              Choose a conversation from the sidebar, or start a new thread to keep moving.
            </EmptyDescription>
          </EmptyHeader>
          {defaultProjectRef ? (
            <EmptyContent>
              <Button size="sm" onClick={() => void handleNewThread(defaultProjectRef)}>
                <PlusIcon />
                Start a new thread
              </Button>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleNewThread(defaultProjectRef, {
                      prompt: "Give me a quick overview of this project and its main parts.",
                    })
                  }
                >
                  Explain this project
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleNewThread(defaultProjectRef, {
                      prompt: "Inspect this project for a concrete bug and suggest a focused fix.",
                    })
                  }
                >
                  Find a bug
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleNewThread(defaultProjectRef, {
                      prompt: "Help me plan and implement a small feature in this project.",
                    })
                  }
                >
                  Build a feature
                </Button>
              </div>
            </EmptyContent>
          ) : null}
        </Empty>
      </div>
    </SidebarInset>
  );
}
