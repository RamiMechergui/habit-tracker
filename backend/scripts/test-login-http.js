async function run() {
  const res = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'street.cherk@gmail.com',
      password: '19981118'
    })
  });

  const body = await res.json();
  console.log(`Status: ${res.status}`);
  console.log('Full Response Body:', body);
}

run().catch(console.error);
