async function test() {
    try {
        const response = await fetch('http://localhost:8000/api/users/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '1234567890' })
        });
        const data = await response.json();
        console.log('Success:', data);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

test();
