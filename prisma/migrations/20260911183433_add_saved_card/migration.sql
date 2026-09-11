-- CreateTable
CREATE TABLE "saved_cards" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cardToken" TEXT NOT NULL,
    "cardMask" TEXT NOT NULL,
    "cardType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_cards_userId_key" ON "saved_cards"("userId");

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
