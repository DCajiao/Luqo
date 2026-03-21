Vamos a diseñar en microservicios un sistema que nos permita digitalizar facturas. 

El sistema se va a componer de los siguientes componentes dockerizados cada uno de forma independiente y orquestados con un docker-compose

Microservicio 1: Frontend. 

Vamos a crear un frontend sencillo que permita habilitar la cámara para tomarle foto a una factura de papel
Debe ser con React + Node

Microservicio 2: Backend. 

El microservicio deberá gestionar los JWT de todos los registros guardados y además se conectará al document AI de gcp para extraer la info y luego le mandará a Gemini para dar insights de la compra

Microservicio 3: Base de datos

Ahí se debe definir el schema de la db y guardar información de la transacción.

