CREATE POLICY "missions_delete_own" ON missions
  FOR DELETE
  USING (planet_id IN (SELECT id FROM planets WHERE player_id = auth.uid()));
