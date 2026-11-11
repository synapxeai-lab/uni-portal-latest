-- CreateIndex
CREATE INDEX "ActivityLog_entityType_action_createdAt_idx" ON "ActivityLog"("entityType", "action", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_moderationStatus_createdAt_idx" ON "Announcement"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_moderationStatus_createdAt_idx" ON "Assignment"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_moderationStatus_createdAt_idx" ON "Comment"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_succeeded_createdAt_idx" ON "LoginAttempt"("succeeded", "createdAt");

-- CreateIndex
CREATE INDEX "Material_moderationStatus_createdAt_idx" ON "Material"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "UserLoginSession_revokedAt_expiresAt_idx" ON "UserLoginSession"("revokedAt", "expiresAt");
