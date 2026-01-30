package ch.iabconnect.keycloak;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

/**
 * Factory for creating DisableNewUsersEventListener instances.
 */
public class DisableNewUsersEventListenerFactory implements EventListenerProviderFactory {

    public static final String PROVIDER_ID = "disable-new-users";

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new DisableNewUsersEventListener(session);
    }

    @Override
    public void init(Config.Scope config) {
        // No initialization needed
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // No post-initialization needed
    }

    @Override
    public void close() {
        // Nothing to close
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }
}
