import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import type { MenuItem } from "primereact/menuitem";
import type { Room, Client } from "../types";
import { roomService, authService } from "../services/api";
import RoomList from "../containers/RoomList";
import "./MainPage.css";

interface MainPageProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export default function MainPage({ isDarkMode, toggleTheme }: MainPageProps) {
  const navigate = useNavigate();
  const menuRef = useRef<Menu>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [user, setUser] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Failed to parse user data:", error);
      }
    }
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const data = await roomService.getRooms();
      setRooms(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await roomService.deleteRoom(roomId);
      setRooms(rooms.filter((r) => r.roomId !== roomId));
    } catch (error) {}
  };

  const menuItems: MenuItem[] = [
    {
      className:"drop-menu-items",
      label: "Update Profile",
      command: () => navigate("/profile/edit"),
    },
    {
      separator: true,
    },
    {
      className:"drop-menu-items",
      label: isDarkMode ? "Light Mode" : "Dark Mode",
      disabled: true, // Disable the dark mode toggle for now
      command: toggleTheme,
    },
    {
      separator: true,
    },
    {
      className:"drop-menu-items",
      label: "Logout",
      command: () => {
        authService.logout();
        navigate("/");
      },
    },
  ];

  return (
    <>
      {/* Header */}
      <header className="main-header">
        <div className="header-container">
          <div className="header-top">
            <Button
              label="Create Hub"
              onClick={() => navigate("/hub/create")}
              className="welcome-button"
            />
            <Menu model={menuItems} popup ref={menuRef} id="popup_menu" className="drop-menu" />
            <Button
              rounded
              icon="pi pi-bars"
              onClick={(e) => menuRef.current?.toggle(e)}
              className="welcome-button p-button-rounded p-button-text"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {loading ? (
          <div className="loading-state">
            <p>Loading hubs...</p>
          </div>
        ) : (
          <RoomList
            rooms={rooms}
            userId={user?.clientUserName}
            onEdit={(room) => navigate(`/hub/${room.roomId}/edit`)}
            onDelete={handleDeleteRoom}
          />
        )}
      </main>
    </>
  );
}
