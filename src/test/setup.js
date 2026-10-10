// Fuso do CD: os testes de data precisam rodar sempre em horário de Brasília,
// não importa onde a máquina/CI esteja.
process.env.TZ = "America/Sao_Paulo";
