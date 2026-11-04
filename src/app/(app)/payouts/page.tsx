import { redirect } from "next/navigation";

/**
 * Saques agora é uma aba do Financeiro: é o mesmo dinheiro, e separá-los obrigava a pessoa a
 * pular entre duas telas para ver o saldo e o que já saiu. A rota continua de pé para os links
 * antigos — e para quem guardou o endereço nos favoritos.
 */
export default function PayoutsPage() {
  redirect("/finance?aba=saques");
}
