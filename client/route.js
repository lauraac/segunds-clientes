(() => {
  const base = '/segunds-clientes/';
  const table = location.pathname.match(/^\/segunds-clientes\/t\/([0-9a-f]{32})\/?$/)?.[1];
  const destination = new URL(base, location.origin);
  if (table) destination.searchParams.set('table', table);
  location.replace(destination);
})();
