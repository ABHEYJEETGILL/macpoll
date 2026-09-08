-- CreateTable
CREATE TABLE "PollParticipation" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollParticipation_userId_idx" ON "PollParticipation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollParticipation_pollId_userId_key" ON "PollParticipation"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "PollParticipation" ADD CONSTRAINT "PollParticipation_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollParticipation" ADD CONSTRAINT "PollParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

