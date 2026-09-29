/**
 * Kenyan bank Lipa Na M-Pesa / Paybill business numbers — same catalog as
 * frontend/lib/kenya-mpesa-banks.ts (custody receive flow).
 */
export type KenyaMpesaBank = {
  id: string;
  name: string;
  businessNumber: string;
};

export const KENYA_MPESA_BANKS: readonly KenyaMpesaBank[] = [
  { id: "equity", name: "Equity Bank", businessNumber: "247247" },
  { id: "coop", name: "Co-operative Bank", businessNumber: "400200" },
  { id: "kcb", name: "Kenya Commercial Bank (KCB)", businessNumber: "522522" },
  { id: "ncba", name: "NCBA", businessNumber: "880100" },
  { id: "family", name: "Family Bank Ltd", businessNumber: "222111" },
  { id: "nbk", name: "National Bank", businessNumber: "547700" },
  { id: "absa", name: "Absa Bank", businessNumber: "303030" },
  { id: "chase", name: "Chase Bank", businessNumber: "552800" },
  { id: "eco", name: "Eco Bank", businessNumber: "700201" },
  { id: "im", name: "I&M Bank", businessNumber: "542542" },
  { id: "stanChart", name: "Standard Chartered Bank", businessNumber: "329329" },
  { id: "imperial", name: "Imperial Bank", businessNumber: "800100" },
  { id: "nic", name: "NIC Bank", businessNumber: "488488" },
  { id: "stanbic", name: "Stanbic Bank", businessNumber: "600100" },
  { id: "abc", name: "ABC Bank", businessNumber: "111777" },
  { id: "dtb", name: "Diamond Trust Bank (DTB)", businessNumber: "516600" },
  { id: "consolidated", name: "Consolidated Bank", businessNumber: "508400" },
  { id: "credit", name: "Credit Bank", businessNumber: "972700" },
  { id: "boa", name: "Bank of Africa", businessNumber: "972900" },
  { id: "jt", name: "JT Bank", businessNumber: "910200" },
  { id: "uba", name: "UBA Bank", businessNumber: "559900" },
  { id: "citi", name: "Citi Bank", businessNumber: "100229" },
  { id: "krep", name: "K-Rep Bank", businessNumber: "111999" },
  { id: "gulf", name: "Gulf African Bank", businessNumber: "985050" },
  { id: "prime", name: "Prime Bank", businessNumber: "982800" },
  { id: "jamii", name: "Jamii Bora Bank", businessNumber: "529901" },
  { id: "ecb", name: "Equatorial Commercial Bank", businessNumber: "498100" },
  { id: "tnb", name: "Transnational Bank", businessNumber: "862862" },
  { id: "hfc", name: "Housing Finance Company (HFC)", businessNumber: "100400" },
  { id: "fcb", name: "First Community Bank Ltd", businessNumber: "919700" },
  { id: "postbank", name: "Post Office Savings Bank", businessNumber: "200999" },
  { id: "guardian", name: "Guardian Bank", businessNumber: "344500" },
] as const;

export const CUSTOM_BANK_ID = "custom";

export function kenyaBankById(id: string | null | undefined): KenyaMpesaBank | undefined {
  if (!id || id === CUSTOM_BANK_ID) return undefined;
  return KENYA_MPESA_BANKS.find((b) => b.id === id);
}

export function kenyaBankByBusinessNumber(
  businessNumber: string | null | undefined,
): KenyaMpesaBank | undefined {
  const digits = (businessNumber ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  return KENYA_MPESA_BANKS.find((b) => b.businessNumber === digits);
}
