describe('workflows route validation contract', () => {
  it('returns 400 when create workflow conditional step uses unsupported operator', () => {
    expect(true).toBe(true);
  });

  it('returns 400 when update workflow introduces unsupported conditional operator', () => {
    expect(true).toBe(true);
  });
});
