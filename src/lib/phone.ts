export function displayPhone(phone: string) {
  const local = phone.replace(/^\+27/, '0');
  return /^0\d{9}$/.test(local)
    ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
    : phone;
}
