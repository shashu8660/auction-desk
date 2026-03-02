"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function DisplayPage() {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamSquad, setTeamSquad] = useState([])
  const [previewImage, setPreviewImage] = useState(null)

  const fetchData = async () => {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")

    setTeams(teamsData || [])
  }

  const fetchTeamSquad = async (teamId) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .in("status", ["sold", "retained"])
      .order("sold_price", { ascending: false })

    setTeamSquad(data || [])
  }

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel("auction-display")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        fetchData
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-4">

      <h1 className="text-3xl font-bold text-center mb-6">
        🏆 TEAM SQUADS
      </h1>

      {/* Pool A */}
      <div className="mb-4">
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-center py-2 rounded-lg font-bold tracking-widest shadow-lg">
          🅰️ POOL A
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {teams
          .filter(team =>
            [
              "Pari Friends Badaholi",
              "Black Panthers Karakadas",
              "Karkada Royals Nellibettu",
              "Ajay Cricket club Kunjigudi"
            ].includes(team.name)
          )
          .map(team => (
            <div
              key={team.id}
              onClick={() => {
                if (selectedTeam?.id === team.id) {
                  setSelectedTeam(null)
                  setTeamSquad([])
                } else {
                  setSelectedTeam(team)
                  fetchTeamSquad(team.id)
                }
              }}
              className="bg-gray-900 p-4 rounded-xl border border-yellow-500 text-center hover:bg-yellow-500/10 transition-all duration-300"
            >
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-12 mx-auto mb-2"
                />
              )}
              <p className="font-semibold text-sm">{team.name}</p>
            </div>
          ))}
      </div>

      {/* Pool B */}
      <div className="mb-4 mt-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white text-center py-2 rounded-lg font-bold tracking-widest shadow-lg">
          🅱️ POOL B
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {teams
          .filter(team =>
            [
              "Aparna Eleven Cricket",
              "SS Super Kings",
              "SD Cricketers Karkada",
              "Girija Road Lines Attackers"
            ].includes(team.name)
          )
          .map(team => (
            <div
              key={team.id}
              onClick={() => {
                if (selectedTeam?.id === team.id) {
                  setSelectedTeam(null)
                  setTeamSquad([])
                } else {
                  setSelectedTeam(team)
                  fetchTeamSquad(team.id)
                }
              }}
              className="bg-gray-900 p-4 rounded-xl border border-blue-500 text-center hover:bg-blue-500/10 transition-all duration-300"
            >
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-12 mx-auto mb-2"
                />
              )}
              <p className="font-semibold text-sm">{team.name}</p>
            </div>
          ))}
      </div>

      {/* Selected Team Squad Popup */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/95 p-4 overflow-y-auto z-50">

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
            <button
              onClick={() => {
                setSelectedTeam(null)
                setTeamSquad([])
              }}
              className="text-red-400 font-bold"
            >Close</button>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-700">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

              {/* Owner Section */}
              <div className="flex items-center gap-4">
                {selectedTeam.owner_photo_url && (
                  <img
                    src={selectedTeam.owner_photo_url}
                    className="w-20 h-20 rounded-full object-cover border-2 border-yellow-400"
                  />
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Owner</p>
                  <p className="text-lg font-semibold">{selectedTeam.owner_name}</p>
                </div>
              </div>

              {/* Retained Players Section */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                  Retained Players
                </p>

                <div className="flex flex-wrap gap-3">
                  {teamSquad
                    .filter(p => p.status === "retained")
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-semibold shadow-md"
                      >
                        {p.image && (
                          <img
                            src={p.image}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        )}
                        <span>{p.name}</span>
                      </div>
                    ))}

                  {teamSquad.filter(p => p.status === "retained").length === 0 && (
                    <p className="text-gray-500 text-xs">No retained players</p>
                  )}
                </div>
              </div>

            </div>

          </div>

          <div className="space-y-3">
            {teamSquad.map(player => (
              <div
                key={player.id}
                className="bg-gray-800 p-3 rounded-lg flex items-center gap-3 border border-gray-700"
              >
                {player.image && (
                  <img
                    src={player.image}
                    className="w-12 h-12 object-cover rounded-md"
                  />
                )}
                <div>
                  <p className="font-semibold text-sm">{player.name}</p>
                  <p className="text-xs text-gray-400">₹{player.sold_price}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  )
}