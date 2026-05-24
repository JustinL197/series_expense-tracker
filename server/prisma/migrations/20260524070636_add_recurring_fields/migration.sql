-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "recurringAutoAdd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurringFreq" TEXT;
