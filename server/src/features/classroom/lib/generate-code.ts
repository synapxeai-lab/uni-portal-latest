// Excludes visually ambiguous characters (i, l, o, 0, 1) so codes are easy to read and type.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 7;

export function generateClassroomCode(): string {
  let code = "";

  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }

  return code;
}
