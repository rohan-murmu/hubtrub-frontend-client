import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../types";
import UserFormTemplate from "../templates/UserFormTemplate";
import { authService } from "../services/api";

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: Client) => {
    try {
      setLoading(true);
      const response = await authService.createUser(data);

      // Store token
      localStorage.setItem("token", response.token);
      localStorage.setItem("client", JSON.stringify(response.client));
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/hub");
      }, 2000);
    } catch (error: unknown) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <UserFormTemplate
        title="Create User"
        onSubmit={handleSubmit}
        loading={loading}
      />
    </>
  );
}
