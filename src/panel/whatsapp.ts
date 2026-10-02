/** Link de WhatsApp con el mensaje ya escrito. Números argentinos sin código de país → +54 9. */
export function whatsappLink(phone: string, text: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!digits.startsWith('54')) digits = `549${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
