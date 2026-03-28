#!/bin/bash
echo "=== AWS Academy Profile Configuration ==="
echo ""
echo "Este script te ayudará a configurar el profile 'aws-academy'"
echo ""
# Solicitar credenciales
read -p "AWS Access Key ID: " access_key
read -p "AWS Secret Access Key: " secret_key
read -p "AWS Session Token: " session_token
# Configurar profile
aws configure set aws_access_key_id "$access_key" --profile aws-academy
aws configure set aws_secret_access_key "$secret_key" --profile aws-academy
aws configure set aws_session_token "$session_token" --profile aws-academy
aws configure set region us-east-1 --profile aws-academy
echo ""
echo "
✅
 Profile 'aws-academy' configurado correctamente"
 echo ""
# Verificar configuración
echo "Verificando credenciales..."
if aws sts get-caller-identity --profile aws-academy > /dev/null 2>&1; then
echo "
✅
 Credenciales válidas"
echo ""
aws sts get-caller-identity --profile aws-academy
echo ""
echo "Para usar este profile en todos los comandos, ejecuta:"
echo "export AWS_PROFILE=aws-academy"
else
echo "
❌
 Error: Las credenciales no son válidas"
exit 1
fi