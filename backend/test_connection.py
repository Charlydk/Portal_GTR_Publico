# test_connection.py
import requests
import httpx
import asyncio

URL = "https://customerapi.geovictoria.com/api/v1/Login"

print(f"--- Probando conexión a: {URL} ---")

# PRUEBA 1: Librería requests (Síncrona, estándar)
print("\n1. Intentando con 'requests'...")
try:
    # Solo probamos que el servidor responda, no importa si da 405 o 400
    response = requests.get(URL, timeout=10) 
    print(f"✅ ÉXITO con requests! Código: {response.status_code}")
except Exception as e:
    print(f"❌ FALLO con requests: {e}")

# PRUEBA 2: Librería httpx (La que usa tu proyecto)
async def test_httpx():
    print("\n2. Intentando con 'httpx'...")
    try:
        async with httpx.AsyncClient(verify=False) as client: # verify=False para descartar SSL
            response = await client.get(URL, timeout=10)
            print(f"✅ ÉXITO con httpx (sin verificar SSL)! Código: {response.status_code}")
    except Exception as e:
        print(f"❌ FALLO con httpx: {repr(e)}")

if __name__ == "__main__":
    asyncio.run(test_httpx())