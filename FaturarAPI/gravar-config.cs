using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length < 2 || string.IsNullOrEmpty(args[1]))
        {
            Console.Error.WriteLine("Uso: gravar-config.cmd \"a-tua-chave\" [http://localhost:50738]");
            return 1;
        }

        string caminho = args[0];
        string chave = args[1];
        string apiBase = args.Length > 2 && !string.IsNullOrWhiteSpace(args[2])
            ? args[2].Trim().TrimEnd('/')
            : LerBase(caminho);

        byte[] segredo = Encoding.UTF8.GetBytes(("FaturarAPI.local.v1" + new string('0', 32)).Substring(0, 32));
        byte[] iv = new byte[16];
        using (var aleatorio = RandomNumberGenerator.Create())
            aleatorio.GetBytes(iv);

        byte[] cifrado;
        using (var aes = Aes.Create())
        {
            aes.Key = segredo;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            using (var ms = new MemoryStream())
            using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
            {
                byte[] plano = Encoding.UTF8.GetBytes(chave);
                cs.Write(plano, 0, plano.Length);
                cs.FlushFinalBlock();
                cifrado = ms.ToArray();
            }
        }

        byte[] pacote = new byte[iv.Length + cifrado.Length];
        Buffer.BlockCopy(iv, 0, pacote, 0, iv.Length);
        Buffer.BlockCopy(cifrado, 0, pacote, iv.Length, cifrado.Length);

        string json = "{\r\n  \"apiBase\": \"" + Escapar(apiBase) + "\",\r\n  \"apiKey\": \"enc:" + Convert.ToBase64String(pacote) + "\"\r\n}\r\n";
        File.WriteAllText(caminho, json, new UTF8Encoding(false));
        Console.WriteLine("config.json atualizado.");
        return 0;
    }

    static string LerBase(string caminho)
    {
        const string omissao = "http://localhost:50738";
        if (!File.Exists(caminho))
            return omissao;

        string texto = File.ReadAllText(caminho);
        int marca = texto.IndexOf("\"apiBase\"", StringComparison.Ordinal);
        if (marca < 0)
            return omissao;
        int abre = texto.IndexOf('"', texto.IndexOf(':', marca) + 1);
        int fecha = abre < 0 ? -1 : texto.IndexOf('"', abre + 1);
        if (abre < 0 || fecha < 0)
            return omissao;
        string valor = texto.Substring(abre + 1, fecha - abre - 1).Trim().TrimEnd('/');
        return string.IsNullOrWhiteSpace(valor) ? omissao : valor;
    }

    static string Escapar(string valor)
    {
        return (valor ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
    }
}
