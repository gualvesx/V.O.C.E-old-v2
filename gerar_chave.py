import base64
import hashlib
import os

# Tenta importar a biblioteca de criptografia (padrão em muitas instalações ou instale com: pip install cryptography)
try:
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
except ImportError:
    print("ERRO: Biblioteca 'cryptography' não encontrada.")
    print("Por favor, rode: pip install cryptography")
    exit()

def generate_key_and_id():
    print("Gerando par de chaves RSA 2048 bits...")
    
    # 1. Gerar Chave Privada
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # 2. Extrair Chave Pública (Formato DER/ASN.1)
    public_key = private_key.public_key()
    public_der = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )

    # 3. Gerar a "Key" para o manifest (Base64 da chave pública DER)
    manifest_key = base64.b64encode(public_der).decode('utf-8')

    # 4. Calcular o ID da Extensão (SHA256 da chave pública -> Hex -> Primeiros 32 chars -> Mapeamento a-p)
    # O Chrome usa um encoding específico base16 mas com letras de 'a' a 'p'
    sha256 = hashlib.sha256(public_der).hexdigest()
    head_32 = sha256[:32]
    
    # Converter hex (0-f) para o alfabeto do Chrome (a-p)
    chrome_id = ""
    for char in head_32:
        if '0' <= char <= '9':
            chrome_id += chr(ord('a') + int(char))
        else:
            chrome_id += chr(ord('a') + (ord(char) - ord('a') + 10))

    print("\n" + "="*60)
    print("SUCESSO! AQUI ESTÃO SEUS DADOS FIXOS:")
    print("="*60)
    print(f"\n>> SEU ID FIXO: {chrome_id}")
    print("(Copie este ID e coloque no seu script do Inno Setup em 'SEU_ID_DA_EXTENSAO_AQUI')")
    
    print("\n>> SUA CHAVE PÚBLICA (KEY):")
    print(f"{manifest_key}")
    print("\n(Copie esta chave inteira e coloque no manifest.json)")
    print("="*60)

if __name__ == "__main__":
    generate_key_and_id()