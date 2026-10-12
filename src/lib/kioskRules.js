// Regras de negócio do Kiosk (funções puras, com testes em __tests__/kioskRules.test.js)

export function shouldAskShortage(session, activities) {
  if (!session) return false;
  const config = activities.find((a) => a.name === session.activity);
  if (config && config.asks_shortage === true) return true;
  if (config && config.asks_shortage === false) return false;
  const askedForOrder = !!(session.order_number || session.customer_name || session.transfer_type);
  return askedForOrder;
}

export function isSeparationEntry(entry) {
  return !!(entry.order_number || entry.transfer_type);
}
