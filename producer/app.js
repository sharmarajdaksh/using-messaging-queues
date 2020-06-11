const amqp = require('amqplib');

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_PASS;
const RABBITMQ_CONNECTION_STRING = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/`;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE;

console.log(RABBITMQ_CONNECTION_STRING);

const getRandomNumber = () => {
	return Math.random();
};

amqp.connect(RABBITMQ_CONNECTION_STRING)
	.then((conn) => {
		console.log('[ Connection Established ] '.toUpperCase());
		//
		// Channel creation is idempotent:
		// A new channel is created only if one doesn't already exist
		//
		return conn.createChannel();
	})
	.then((chan) => {
		//
		// To send, we must declare a queue for us to send to
		//
		return chan
			.assertQueue(RABBITMQ_QUEUE, {
				durable: false,
			})
			.then(() => {
				//
				// We can then publish a message to the queue
				// Data is sent as byte streams so any content works
				//
				let n = 0;
				let interval = setInterval(() => {
					n++;
					let randomNumber = getRandomNumber();
					chan.sendToQueue(
						RABBITMQ_QUEUE,
						Buffer.from(randomNumber.toString())
					);

					console.log(`[ Sent:     ${randomNumber} ] `.toUpperCase());

					if (n === 50) {
						clearInterval(interval);
					}
				}, 1000);
			});
	})
	.catch((err) => {
		console.log(err);
	});

//
// For this example, the producer sends messages to the queue every 0.25 seconds
// The consumer, however, only processes a message per second
// No problem. This is the kind of situation messaging queues are supposed to
// be useful in
