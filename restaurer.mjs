// Restauration d'une sauvegarde chiffrée : node outils/restaurer.mjs cle-privee.pem sauvegarde-AAAA-MM-JJ.enc > donnees.json
// © D'jims ANDRÉ · Tous droits réservés
import { readFileSync } from "node:fs";
import { privateDecrypt, createDecipheriv, constants } from "node:crypto";
import { gunzipSync } from "node:zlib";
const [cle, fichier] = process.argv.slice(2);
const buf = readFileSync(fichier), i = buf.indexOf(10), t = JSON.parse(buf.subarray(0, i).toString());
const k = privateDecrypt({ key: readFileSync(cle), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(t.cle, "base64"));
const d = createDecipheriv("aes-256-gcm", k, Buffer.from(t.iv, "base64")); d.setAuthTag(Buffer.from(t.tag, "base64"));
process.stdout.write(gunzipSync(Buffer.concat([d.update(buf.subarray(i + 1)), d.final()])));
