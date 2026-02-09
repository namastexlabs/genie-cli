#!/bin/bash
cd /home/genie/workspace/worktrees/genie-cli/hooks-v2
claudio launch -- --dangerously-skip-permissions -p "Read WORKER-PROMPT.md in the current directory for your full mission brief. Execute ALL 6 phases autonomously (Explore, Wish, Plan-Review, Implement, Review, PR). Do not ask questions — make reasonable decisions and document them in the wish. Keep scope TIGHT — 2-3 hooks max, self-contained .js scripts. Build passes and types check before committing. Push branch and create draft PR when done. Start now."
