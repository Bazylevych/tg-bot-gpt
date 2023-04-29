build:
	docker build -t telebotgpt .

run:
	docker run -p 3000:3000 --name telebotgpt --rm telebotgpt