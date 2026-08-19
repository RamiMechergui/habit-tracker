async function run() {
  console.log('--- Testing test@gmail.com ---');
  const res1 = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@gmail.com',
      password: '123456789'
    })
  });
  console.log('Status test@gmail.com:', res1.status, await res1.json());

  console.log('\n--- Testing street.cherk@gmail.com ---');
  const res2 = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'street.cherk@gmail.com',
      password: '19981118'
    })
  });
  console.log('Status street.cherk@gmail.com:', res2.status, await res2.json());
}

run().catch(console.error);
