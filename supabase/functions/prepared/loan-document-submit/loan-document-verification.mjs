// A loan reuses registered originals; upload codec/size policy is not retroactive.
// Descriptors come from authenticated preparation and are rechecked by the SQL
// completion under locks. Never accept a hash/size supplied by the browser here.
export function loanSubmissionVerifier(verifier, functionName) {
  if (functionName !== 'create_validated_financial_program_request') return verifier;
  return async (bytes, mime, sha256, size) => {
    const receipt = await verifier(bytes, mime, sha256, size, { existingRead: true });
    if (receipt.integrityVerified !== true) throw new Error('BYTE_INTEGRITY_MISMATCH');
    return { ...receipt, verified: true };
  };
}
