export function buildEnquiry(name: string, message: string, phone = '+27835043385') {
  const cleanName = name.trim().replace(/[\r\n]+/g, ' ');
  const cleanMessage = message.trim();
  if (!cleanName || cleanName.length > 80 || !cleanMessage || cleanMessage.length > 1000) {
    throw new Error('Enter a name up to 80 characters and a message up to 1,000 characters.');
  }
  const text = `Hello S & D Fruit and Veg, my name is ${cleanName}.\n\n${cleanMessage}`;
  const normalized = phone.startsWith('0') ? `27${phone.slice(1)}` : phone.replace(/^\+/, '');
  if (!/^27[1-9]\d{8}$/.test(normalized)) throw new Error('Invalid shop contact number.');
  return { text, url: `https://wa.me/${normalized}?text=${encodeURIComponent(text)}` };
}
